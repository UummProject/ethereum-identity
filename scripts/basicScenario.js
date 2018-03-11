
const Web3 = require ('web3')
//const Contract = require ('truffle-contract')
//const IdentityArtifact = require('../build/contracts/Identity.json')
let IdentityAbi = require('../build/Identity.json')

//console.log(JSON.parse(IdentityAbi))

Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send
let wsProvider = new Web3.providers.WebsocketProvider("ws://localhost:8545")
let web3 = new Web3(wsProvider)

//let IdentityContract = Contract(IdentityArtifact)
let IdentityContract = new web3.eth.Contract(IdentityAbi)

IdentityContract.setProvider(wsProvider)

        
async function run()
{
    let accounts = await web3.eth.getAccounts()
    
    //let UserIdentityContract =  await IdentityContract.new({from:accounts[0]})

   let deployed = await IdentityContract.deploy()

    console.log(deployed)
}    

run()
.then(() =>  {
    console.log("Finalized!");
    process.exit(0);
})
.catch((error)=>
{
    console.log(error)
    process.exit(1)
})


/*
let IdentityContract = Contract(IdentityArtifact)
IdentityContract.setProvider(provider)

let UserIdentityContract
IdentityContract.new({from:accounts[0]}).then((instance)=>
{
    console.log(instance)
    UserIdentityContract = instance
})


console.log(UserIdentityContract)*/