
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
let userIdentityContract = {}
let deployGasCost = 0
let deployTransaction = {}

newDid =()=>
{
    return new Promise((resolve, reject)=>{
        deployTransaction = BaseIdentityContract.deploy({ data:IdentityBin, arguments:[]})
        deployTransaction.send( {from: accounts[0], gas: deployIdentityGasCost, gasPrice: 1})
            .on('error', function(error){ console.error(error) })
            //.on('transactionHash', function(transactionHash){ console.log(transactionHash)})
            //.on('confirmation', function(confirmationNumber, receipt){ console.log (confirmationNumber, receipt) })
            //.on('receipt', function(receipt){ console.log(receipt.contractAddress)})
            .then(function(newContractInstance){
                resolve(newContractInstance)
            });
    })
    
}

run =()=>{
    return new Promise((resolve, reject)=>{

        web3.eth.getAccounts()
        .then((a)=>{
            accounts = a
        })
        .then(()=>
        {
            newDid().then((contract)=>{
                console.log(contract)
            })
        })
        /*.then(()=>{
            deployTransaction = BaseIdentityContract.deploy({ data:IdentityBin, arguments:[]})
            return deployTransaction.estimateGas()
        })
        .then((gasCost)=>{
            deployGasCost = gasCost
            deployTransaction.send( {from: accounts[0], gas: deployGasCost, gasPrice: 1})
            .on('error', function(error){ console.error(error) })
            .on('transactionHash', function(transactionHash){ console.log(transactionHash)})
            .on('confirmation', function(confirmationNumber, receipt){ console.log (confirmationNumber, receipt) })
            .on('receipt', function(receipt){ console.log(receipt.contractAddress)})
            .then(function(newContractInstance){
                console.log(newContractInstance.options.address) // instance with the new contract address
                console.log(gasCost)
                resolve(1)
            });
        })*/
    })
};



run()
.then(() =>  {console.log("Done!"); process.exit(0);})
.catch((error)=>{console.log(error);process.exit(1);})