
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

let EMITTER = ""
let USER1 = ""
let USER2 = ""

newDid =(address)=>
{
    console.log(address)
    return new Promise((resolve, reject)=>{
        let deployTransaction = BaseIdentityContract.deploy({ data:IdentityBin, arguments:[]})
        deployTransaction.send( {from: address, gas: deployIdentityGasCost, gasPrice: 1})
            .on('error', function(error){ console.error(error) })
            //.on('transactionHash', function(transactionHash){ console.log(transactionHash)})
            //.on('confirmation', function(confirmationNumber, receipt){ console.log (confirmationNumber, receipt) })
            .on('receipt', function(receipt){ console.log(receipt.contractAddress)})
            .then(function(newContractInstance){
                //console.log(address, newContractInstance.defaultAccount)
                dids[accounts[address],newContractInstance]
                resolve(newContractInstance)
            });
    })
}

createAllDids=(availableAccounts)=>
{
    accounts = availableAccounts
    return new Promise((resolve, reject)=>{
        EMITTER = accounts[0]
        USER1 = accounts[1]
        USER2 = accounts[2]
        Promise.all([
            newDid(EMITTER),
            newDid(USER1),
            newDid(USER2)
        ])
        .then(resolve)
        .catch(reject)
    })
}

run =()=>{
    return new Promise((resolve, reject)=>{
        web3.eth.getAccounts()
        .then(createAllDids)
        .then(resolve)
    })
};



run()
.then(() =>  {console.log("Done!"); process.exit(0);})
.catch((error)=>{console.log(error);process.exit(1);})