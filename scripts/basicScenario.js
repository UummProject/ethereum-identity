
const Web3 = require ('web3')
//const Contract = require ('truffle-contract')
//const IdentityArtifact = require('../build/contracts/Identity.json')
let IdentityAbi = require('../build/Identity.json')
let IdentityBin = require('../build/Identity.bin.json')

//console.log(JSON.parse(IdentityAbi))

Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send
let wsProvider = new Web3.providers.WebsocketProvider("ws://localhost:8545")
let web3 = new Web3(wsProvider)

//let IdentityContract = Contract(IdentityArtifact)
let BaseIdentityContract = new web3.eth.Contract(IdentityAbi)
BaseIdentityContract.setProvider(wsProvider)

let accounts = []
let userIdentityContract = {}


run =()=>{
    return new Promise((resolve, reject)=>{

        web3.eth.getAccounts()
        .then((a)=>{
            accounts = a
        })
        .then(()=>{
            let deployTransaction = BaseIdentityContract.deploy({ data:IdentityBin, arguments:[]})
        })

        .then(()=>{
            
            resolve(1)
        })
    })
}


run()
.then(() =>  {
    console.log("Done!");
    process.exit(0);
})
.catch((error)=>
{
    console.log(error)
    process.exit(1)
})
