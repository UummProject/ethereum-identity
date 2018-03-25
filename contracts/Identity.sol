
    pragma solidity ^0.4.17;

    import "./ERC725.sol";
    import "./ERC735.sol";

    contract Identity is ERC725, ERC735 {

        //ERC725
        uint256 executionNonce;

        struct Execution {
            address to;
            uint256 value;
            bytes data;
            bool approved;
            bool executed;
        }

        mapping (bytes32 => Key) keys;
        mapping (uint256 => bytes32[]) keysByPurpose;
        mapping (uint256 => Execution) executions;

        event ExecutionFailed(uint256 indexed executionId, address indexed to, uint256 indexed value, bytes data);

        function Identity() public {
            bytes32 _key = keccak256(msg.sender);
            keys[_key].key = _key;
            keys[_key].purpose = 1;
            keys[_key].keyType = 1;
            keysByPurpose[1].push(_key);
            emit KeyAdded(_key, keys[_key].purpose, 1);
        }

        function getKey(bytes32 _key)
            public
            view
            returns(uint256 purpose, uint256 keyType, bytes32 key)
        {
            return (keys[_key].purpose, keys[_key].keyType, keys[_key].key);
        }

        function getKeyPurpose(bytes32 _key)
            public
            view
            returns(uint256 purpose)
        {
            return (keys[_key].purpose);
        }

        function getKeysByPurpose(uint256 _purpose)
            public
            view
            returns(bytes32[] _keys)
        {
            return keysByPurpose[_purpose];
        }

        function addKey(bytes32 _key, uint256 _purpose, uint256 _type)
            public
            returns (bool success)
        {
            require(keys[_key].key != _key); // Key should not already exist
            if (msg.sender != address(this)) {
            require(keyHasPurpose(keccak256(msg.sender), 1)); // Sender has MANAGEMENT_KEY
            }

            keys[_key].key = _key;
            keys[_key].purpose = _purpose;
            keys[_key].keyType = _type;

            keysByPurpose[_purpose].push(_key);

            emit KeyAdded(_key, _purpose, _type);

            return true;
        }

        function approve(uint256 _id, bool _approve)
            public
            returns (bool success)
        {
            keyHasPurpose(keccak256(msg.sender),2);

            emit Approved(_id, _approve);

            if (_approve != true) {
                executions[_id].approved = false;
                return true;
            }

            executions[_id].approved = true;
            success = executions[_id].to.call(executions[_id].data);
            if (success) {
                executions[_id].executed = true;
                emit Executed(
                    _id,
                    executions[_id].to,
                    executions[_id].value,
                    executions[_id].data
                );
                return;
            } else {
                emit ExecutionFailed(
                    _id,
                    executions[_id].to,
                    executions[_id].value,
                    executions[_id].data
                );
                return;
            }

            return true;
        }

        function execute(address _to, uint256 _value, bytes _data)
            public
            returns (uint256 executionId)
        {
            require(!executions[executionNonce].executed);
            executions[executionNonce].to = _to;
            executions[executionNonce].value = _value;
            executions[executionNonce].data = _data;

            emit ExecutionRequested(executionNonce, _to, _value, _data);

            if (keyHasPurpose(keccak256(msg.sender),1) || keyHasPurpose(keccak256(msg.sender),2)) {
                approve(executionNonce, true);
            }

            executionNonce++;
            return executionNonce-1;
        }

        function removeKey(bytes32 _key)
            public
            returns (bool success)
        {
            require(keys[_key].key == _key);
            emit KeyRemoved(keys[_key].key, keys[_key].purpose, keys[_key].keyType);

            /* uint index;
            (index,) = keysByPurpose[keys[_key].purpose.indexOf(_key);
            keysByPurpose[keys[_key].purpose.removeByIndex(index); */

            delete keys[_key];

            return true;
        }

        function keyHasPurpose(bytes32 _key, uint256 _purpose)
            public
            view
            returns(bool result)
        {
            bool isThere;
            if (keys[_key].key == 0) return false;
            isThere = keys[_key].purpose <= _purpose;
            return isThere;
        }

        //EIP735
        bytes32 claimId;
        mapping (bytes32 => Claim) claims;
        mapping (uint256 => bytes32[]) claimsByType;

        function addClaim(
            uint256 _claimType,
            uint256 _scheme,
            address _issuer,
            bytes _signature,
            bytes32 _data,
            string _uri
        )
            public
            returns (bytes32 claimRequestId)
        {
            claimId = keccak256(_issuer, _claimType);
            //KeyHolder issuer = KeyHolder(issuer);

            if (msg.sender != address(this)) {
                require(keyHasPurpose(keccak256(msg.sender), 3));
            }

            if (claims[claimId].issuer != _issuer) {
                claimsByType[_claimType].push(claimId);
            }

            claims[claimId].claimType = _claimType;
            claims[claimId].scheme = _scheme;
            claims[claimId].issuer = _issuer;
            claims[claimId].signature = _signature;
            claims[claimId].data = _data;
            claims[claimId].uri = _uri;

            emit ClaimAdded(
                claimId,
                _claimType,
                _scheme,
                _issuer,
                _signature,
                _data,
                _uri
            );

            return claimId;
        }

        function removeClaim(bytes32 _claimId) public returns (bool success) {
            require(
                msg.sender == claims[_claimId].issuer ||
                msg.sender == address(this)
            );

            emit ClaimRemoved(
                _claimId,
                claims[_claimId].claimType,
                claims[_claimId].scheme,
                claims[_claimId].issuer,
                claims[_claimId].signature,
                claims[_claimId].data,
                claims[_claimId].uri
            );

            delete claims[_claimId];
            return true;
        }

        function getClaim(bytes32 _claimId)
            public
            constant
            returns(
                uint256 claimType,
                uint256 scheme,
                address issuer,
                bytes signature,
                bytes32 data,
                string uri
            )
        {
            return (
                claims[_claimId].claimType,
                claims[_claimId].scheme,
                claims[_claimId].issuer,
                claims[_claimId].signature,
                claims[_claimId].data,
                claims[_claimId].uri
            );
        }

        function getClaimSig(bytes32 _claimId)
            public
            constant
            returns(
            bytes32 data,
            bytes32 r,
            bytes32 s,
            uint8 v
            )
        {
            bytes32 ra;
            bytes32 sa;
            uint8 va;

            bytes memory sig = claims[_claimId].signature;
            bytes32 claimData = claims[_claimId].data;

            // Check the signature length
            if (sig.length != 65) {
            return (0, 0, 0, 0);
            }

            // Divide the signature in r, s and v variables
            assembly {
            ra := mload(add(sig, 32))
            sa := mload(add(sig, 64))
            va := byte(0, mload(add(sig, 96)))
            }

            if (va < 27) {
            va += 27;
            }

            return (claimData, ra, sa, va);
        }

        function getClaimIdsByType(uint256 _claimType)
            public
            constant
            returns(bytes32[] claimIds)
        {
            return claimsByType[_claimType];
        }
    }


