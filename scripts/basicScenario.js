const Web3 = require ('web3')

const IdentityAbi = require('../build/Identity.abi.json')
const IdentityBin = require('../build/Identity.bin.json').bytecode

const deployIdentityGasCost = 1700000
const makeClaimGasCost = 350000

Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send
getWsProvider=()=> new Web3.providers.WebsocketProvider("ws://localhost:8545")
let web3 = new Web3(getWsProvider())

let accounts = []//contains account objects including private keys {privateKey:123, address:0x12...}
let dids = {}//{'contractOwnerAddress':'contractAddress',...}

let EMITTER = 0
let USER1 = 1
let USER2 = 2

emitterClaimSignerAccount ={} // This is just to sign claims. Key needs to be different from address
let GAS_PRICE = 0

//https://w3c-ccg.github.io/did-spec/#dfn-did-scheme
let CLAIM_CONTENT = '{ "did": "did:entityUserBelongs:userEntityId" }'
let CLAIM_TYPE = 1

//Specs:https://github.com/ethereum/EIPs/issues/725
//Specs:https://github.com/ethereum/EIPs/issues/735

createIdentityContractInstance = (contractAddress) =>
{
    let identityContract = new web3.eth.Contract(IdentityAbi, contractAddress)
    identityContract.setProvider(getWsProvider())  
    return identityContract
}

newDid =(account)=>
{
    let contractInstance = createIdentityContractInstance()
    let deployTransaction = contractInstance.deploy({ data:IdentityBin, arguments:[]}) 
    let encodedAbi = deployTransaction.encodeABI()
    let transaction = {
        gas: deployIdentityGasCost,
        gasPrice: GAS_PRICE,
        data: encodedAbi,
        from: account.address
    }

    return signAndSendTransaction(account, transaction)
}

createAllDids=(accounts)=>
{ 
    return new Promise((resolve, reject)=>{

        let createNextDid=(index)=>
        {
            if(index>=accounts.length)
                resolve()


    
            newDid(accounts[index])
            .then((didContractInstance)=>{
                dids[accounts[index].address] = didContractInstance.contractAddress
                //console.log(didContractInstance)
                let identityContract = createIdentityContractInstance(didContractInstance.contractAddress)
                identityContract.events.allEvents({fromBlock: 'latest' })
                .on('data', (r)=>console.log('allEvents > Account '+index, r.event))
                .on('error', (e)=>console.log('allEvents > Account '+index,e))
                
                identityContract.events.ExecutionRequested({fromBlock: 'latest' })
                .on('data', (r)=>console.log('ExecutionRequested > Account '+index, r.returnValues))
                .on('error', (e)=>console.log('ExecutionRequested > Account '+index,e))

                identityContract.events.ClaimAdded({fromBlock: 'latest' })
                .on('data', (r)=>console.log('ClaimAdded > Account '+index, r.returnValues))
                .on('error', (e)=>console.log('ClaimAdded > Account '+index,e))
                
                identityContract.events.ClaimAdded({},(error, event)=>{console.log(error, event)})
                console.log('Did created '+ didContractInstance.contractAddress +' from '+ accounts[index].address)
                index ++
                createNextDid(index)
            })
            .catch(reject)
        }
        createNextDid(0)
    })
}

getKey=(contractAddress, key)=>
{
    let identityContract = createIdentityContractInstance(contractAddress)
    return identityContract.methods.getKey(key).call()
}

addKey=(account, contractAddress, key, keyPurpose, keyType)=>
{
    /*
        Key purposes:
        1: MANAGEMENT keys, which can manage the identity
        2: ACTION keys, which perform actions in this identities name (signing, logins, transactions, etc.)
        3: CLAIM signer keys, used to sign claims on other identities which need to be revokable.
        4: ENCRYPTION keys, used to encrypt data e.g. hold in claims.
    */

    /*KeyType: 
        1 : ECDSA
        2 : RSA
    */

    let identityContract = createIdentityContractInstance()
    let encodedAbi = identityContract.methods.addKey(key, keyPurpose, keyType).encodeABI()

    let transaction = {
        gas: deployIdentityGasCost,
        gasPrice: GAS_PRICE,
        data: encodedAbi,
        from: account.address,
        to:contractAddress
    }

    return signAndSendTransaction(account, transaction)
}

createAccount=()=>
{
    let privateKey = web3.utils.randomHex(32)
    let account = web3.eth.accounts.privateKeyToAccount(privateKey)
    return account
}

createAllAccounts=(num)=>
{
    let accounts = []
    for(let i = 0; i<= num; i++)
        accounts.push(createAccount())
    return accounts
}

getSignature=(account, claimType, data)=>
{
    /*
        Signature which is the proof that the claim issuer issued a claim of claimType for this identity.
        It MUST be a signed message of the following structure:
        keccak256(address subject_address, uint256 _claimType, bytes data)
    */
    let password = ""
    let hash = web3.utils.keccak256(account.address,claimType,data)
    let signatureObject = web3.eth.accounts.sign(hash, account.privateKey)

    return signatureObject
}

createClaim=(account, claimContent)=>
{  
    /*
        Scheme:
        The scheme with which this claim SHOULD be verified or how it should be processed.
        Its a uint256 for different schemes.
        E.g. could 3 mean contract verification,
        where the data will be call data,
        and the issuer a contract address to call (ToBeDefined).
        Those can also mean different key types e.g. 1 = ECDSA, 2 = RSA, etc. (ToBeDefined)
    */
   
    /*
       claimType:
       The number which represents the type of claim.
       (e.g. 1 biometric, 2 residence (ToBeDefined))
    */

    let scheme = 1
    let claimType = CLAIM_TYPE
    let claimData = web3.utils.keccak256(claimContent)
    let signature = getSignature(account, claimType, claimData).signature

    let claim = {
        claimType : claimType,
        scheme:scheme,
        issuer:account.address,
        signature : signature,
        data : claimData,
        uri : "Location of the claim",//Voting contract address?
    }
    return claim
}

makeClaim=(emitterAccount, recieverContractAddress, claim)=>
{
    let recieverIdentityContract = createIdentityContractInstance(recieverContractAddress)
    let emitterIdentityContract = createIdentityContractInstance(emitterAccount.address)
    //emitterIdentityContract.events.ExecutionRequested({fromBlock: 'latest' }, (error,event)=>{console.log(error,event)})
    let claimAbi = recieverIdentityContract.methods.addClaim(claim.claimType, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri).encodeABI()
    let executeAbi = emitterIdentityContract.methods.execute(recieverContractAddress, 0, claimAbi).encodeABI()
    let transaction = {
        gas: makeClaimGasCost,
        gasPrice: GAS_PRICE,
        data: executeAbi,
        //from: '0x000000000000000000000000000000000000dEaD',
        to:recieverContractAddress,
        value:0
    }

    return signAndSendTransaction(emitterAccount, transaction)
}

verifyClaim=(claim, contractAddress)=>
{
    return new Promise((resolve, reject)=>{

        let identityContract = createIdentityContractInstance(contractAddress)
        let claimId = getClaimId(claim.issuer, claim.claimType)
        console.log('claimId:', claimId)
        identityContract.methods.getClaimSig(claimId).call()
        .then((signature)=>{
            console.log(signature)
            resolve()
        })
    })
}

getClaimId=(issuerAddress, claimType)=>
{
     return web3.utils.keccak256(issuerAddress, claimType)
}

signAndSendTransaction=(account, transaction)=>
{
    return account.signTransaction(transaction)
    .then((signedTransaction)=>
        web3.eth.sendSignedTransaction(signedTransaction.rawTransaction))
}

getClaimsByType=(contractAddress, type)=>
{
    return new Promise((resolve, reject)=>{

        let identityContract = createIdentityContractInstance(contractAddress)
        identityContract.methods.getClaimIdsByType(type).call()
        .then((claimIds)=>{
            resolve(claimIds)
        })
    })
}

run =()=>{
    return new Promise((resolve, reject)=>{
        //web3.eth.getAccounts() // We don't use getAccounts() because sign function is not exposed
        accounts =  createAllAccounts(10)
        emitterClaimSignerAccount = createAccount()
        //Deploy multiple identity contracts
        createAllDids(accounts)
        .then(()=>getKey(dids[accounts[EMITTER].address],  web3.utils.keccak256(accounts[EMITTER].address)))
        //One of the identities will be the one making the claim (EMITTER)
        //Claims needs to be done from a public key for this purpose
        //We add a new key to the EMITTER identity
        .then(()=>addKey(accounts[EMITTER], dids[accounts[EMITTER].address], web3.utils.keccak256(emitterClaimSignerAccount.address), 3, 1 ))
        //We create and sign the claim
        .then(()=>createClaim(accounts[EMITTER], CLAIM_CONTENT))
        //We ad the claim to USER1 identity through the EMITTER identity
        .then((claim)=>makeClaim(accounts[EMITTER], dids[accounts[USER1].address], claim))
        .then((r)=>console.log('Claim made at '+ dids[accounts[USER1].address]+ " by "+dids[accounts[EMITTER].address]))
        .then(()=>getClaimsByType(dids[accounts[USER1].address],CLAIM_TYPE))
        .then((claimIds)=>console.log('Existing claims at '+ dids[accounts[USER1].address], claimIds))
        //.then(()=>createClaim(accounts[EMITTER], CLAIM_CONTENT))
        //.then((claim)=>verifyClaim(claim, dids[accounts[USER1].address]))
        .catch((e)=>{
            console.error(e)
            reject(
        )})
    })
};

run()
.then(() =>  {
    console.log("Done!")
    process.exit(0)
})
.catch((error)=>{
    console.log(error)
    process.exit(1)
})