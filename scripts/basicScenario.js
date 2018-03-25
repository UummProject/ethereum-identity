
const Web3 = require ('web3')

const IdentityAbi = require('../build/Identity.abi.json')
const IdentityBin = require('../build/Identity.bin.json').bytecode

const deployIdentityGasCost = 1700000
const makeClaimGasCost = 130000

Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send
let wsProvider = new Web3.providers.WebsocketProvider("ws://localhost:8545")
let web3 = new Web3(wsProvider)

let accounts = [] //
let dids = {}// contractOwnerAddress:contractAddress

let EMITTER = 0
let USER1 = 1
let USER2 = 2

emitterClaimSignerAccount ={} // This is just to sign claims. Key needs to be different from address
let GAS_PRICE = 0



//https://w3c-ccg.github.io/did-spec/#dfn-did-scheme
let CLAIM_CONTENT = '{ "did": "did:entityUserBelongs:userEntityId" }'

createIdentityContractInstance = (contractAddress) =>
{
    let identityContract = new web3.eth.Contract(IdentityAbi, contractAddress)
    identityContract.setProvider(wsProvider)
    return identityContract
}

newDid =(account)=>
{
    return new Promise((resolve, reject)=>{
        let contractInstance = createIdentityContractInstance()
        let deployTransaction = contractInstance.deploy({ data:IdentityBin, arguments:[]}) 
        let encodedAbi = deployTransaction.encodeABI()

        let transaction = {
            gas: deployIdentityGasCost,
            gasPrice: GAS_PRICE,
            data: encodedAbi,
            from: account.address
        }

        account.signTransaction(transaction)
        .then((signedTransaction)=>{
            web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
            .on('error', function(error){ console.error(account.address,error) })
            //.on('transactionHash', function(transactionHash){ console.log("transaction hash", account.address,transactionHash)})
            //.on('confirmation', function(confirmationNumber, receipt){ console.log ("confirmationNumber",account.address,confirmationNumber) })
            //.on('receipt', function(receipt){ console.log("receipt", account.address,receipt.blockNumber)})
            .then(function(newContractInstance){
                console.log("Did created " + newContractInstance.contractAddress+" from " + account.address)
                dids[account.address] = newContractInstance.contractAddress
                resolve(newContractInstance)
            });
        })
    })
}

createAllDids=(accounts)=>
{ 
    return new Promise((resolve, reject)=>{

        let createNextDid=(index)=>
        {
            if(index>=accounts.length)
                resolve()
            
            newDid(accounts[index])
            .then(()=>{
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
    //Specs:https://github.com/ethereum/EIPs/issues/725

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

    return new Promise((resolve, reject)=>{

        let identityContract = createIdentityContractInstance()
        let encodedAbi = identityContract.methods.addKey(key, keyPurpose, keyType).encodeABI()

        let transaction = {
            gas: deployIdentityGasCost,
            gasPrice: GAS_PRICE,
            data: encodedAbi,
            from: account.address,
            to:contractAddress
        }

        account.signTransaction(transaction)
        .then((signedTransaction)=>{
            console.log(signedTransaction)
            web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
            .on('error', function(error){ 
                console.error("Failed adding key" ,error)
                reject()
            })
            .then(function(receipt){
                console.log("Added key "+key+' of type '+ keyType + ' to did contract ' +contractAddress )
                resolve()
            });
        })
    })
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
    let claimType = 3
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

makeClaim=(account, contractAddress, claim)=>
{

    return new Promise((resolve, reject)=>{
        
        let identityContract = createIdentityContractInstance(contractAddress)
        let claimTransaction = identityContract.methods.addClaim(claim.claimType, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri)
        
        let encodedAbi = claimTransaction.encodeABI()
        let transaction = {
            gas: makeClaimGasCost,
            gasPrice: GAS_PRICE,
            data: encodedAbi,
            from: account.address,
            to:contractAddress,
            value:'0'
        }

        account.signTransaction(transaction)
        .then((signedTransaction)=>{
            web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
            .on('error', function(error){
                console.error(account.address,error)
                reject()
            })
            .then(function(receipt){
                console.log("Claim made",receipt)
                resolve()
            })
        })
        .catch((e)=>{
            console.error(e)
            reject(
        )})
    })
}

run =()=>{
    return new Promise((resolve, reject)=>{
        //web3.eth.getAccounts() // We don't use getAccounts() because sign function is not exposed
        accounts =  createAllAccounts(10)
        emitterClaimSignerAccount = createAccount()
        createAllDids(accounts)
        .then(()=>getKey(dids[accounts[EMITTER].address],  web3.utils.keccak256(accounts[EMITTER].address)))
        //.then((r)=>console.log(r))
        .then(()=>addKey(accounts[EMITTER], dids[accounts[EMITTER].address], web3.utils.keccak256(emitterClaimSignerAccount.address), 3, 1 ))
        .then(()=>createClaim(accounts[EMITTER], CLAIM_CONTENT))
        .then((claim)=>makeClaim(emitterClaimSignerAccount, dids[accounts[USER1].address], claim))
        .then(resolve)
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