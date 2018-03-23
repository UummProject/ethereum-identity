
const Web3 = require ('web3')

const IdentityAbi = require('../build/Identity.abi.json')
const IdentityBin = require('../build/Identity.bin.json').bytecode

const deployIdentityGasCost = 1700000

Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send
let wsProvider = new Web3.providers.WebsocketProvider("ws://localhost:8545")
let web3 = new Web3(wsProvider)

let BaseIdentityContract = new web3.eth.Contract(IdentityAbi)
BaseIdentityContract.setProvider(wsProvider)

let accounts = []
let dids = {}

let EMITTER = 0
let USER1 = 1
let USER2 = 2
let GAS_PRICE = 0

//https://w3c-ccg.github.io/did-spec/#dfn-did-scheme
let CLAIM = '{ "did": "did:entityUserBelongs:userEntityId" }'

newDid =(account)=>
{
    return new Promise((resolve, reject)=>{
        let deployTransaction = BaseIdentityContract.deploy({ data:IdentityBin, arguments:[], from: account.address, gas: deployIdentityGasCost, gasPrice: GAS_PRICE}) 
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
                console.log("Did created",account.address, newContractInstance.contractAddress)
                dids[account.address] = newContractInstance
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
    signature: Signature which is the proof that the claim issuer issued a claim of claimType for this identity.
    It MUST be a signed message of the following structure:
    keccak256(address subject_address, uint256 _claimType, bytes data)
    */
    let password = ""
    let hash = web3.utils.keccak256(account.address,claimType,data)
    let str= hash+" "//TODO: Why can't I just use the hash directly?
    let signedHash = web3.eth.accounts.sign(str, account.privateKey)
    return signedHash
    //return web3.eth.personal.sign(hash, account.address)
   // return web3.eth.accounts.sign(data, prvSigner)
}

createClaim=(account, claimData)=>
{
    let scheme = 1
    let claimType = 1

    return new Promise((resolve, reject)=>{

        console.log(getSignature(account, claimType, claimData))
        /*
        .then((signature)=>{

            let claim = {
                scheme:scheme,
                claimType : claimType,
                data : claimData,
                uri : "",
                signature : signature
            }

            resolve(claim)
        })
        .catch(reject)*/
    })

}

makeClaim=(issuer, reciever, claim)=>
{
    return new Promise((resolve, reject)=>{

        let claimTransaction = dids[reciever].methods.addClaim(claim.claimType, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri)
        claimTransaction.send( {from: issuer, $extraGas:100000, gasPrice: GAS_PRICE})
        .on('error', function(error){ reject() })
        .then(function(receipt){
            console.log("Claim exectued", receipt)
            resolve()
        });
    })
}

run =()=>{
    return new Promise((resolve, reject)=>{
        //web3.eth.getAccounts() // We don't use getAccounts() because sign function is not exposed
        accounts =  createAllAccounts(10)
        createAllDids(accounts)
        .then(()=>createClaim(accounts[EMITTER],CLAIM))
        //.then((claim)=>makeClaim(EMITTER, USER1, claim))
        .then(resolve)
        .catch((e)=>{console.error(e);reject()})
    })
};

run()
.then(() =>  {console.log("Done!"); process.exit(0);})
.catch((error)=>{console.log(error);process.exit(1);})