const fs = require("fs");
const solc = require('solc')
const mkdirp = require ('mkdirp')
const buildDirectory = './build'

var input = {
    'ERC725.sol': fs.readFileSync('contracts/ERC725.sol', 'utf8'),
    'ERC735.sol': fs.readFileSync('contracts/ERC735.sol', 'utf8'),
    'Identity.sol': fs.readFileSync('contracts/Identity.sol', 'utf8'),
};
let compiledContract = solc.compile({sources: input}, 1);
let errors = compiledContract.errors

if(errors && errors.length)
    errors.forEach((e)=>{console.error(e)})

let abi = compiledContract.contracts['Identity.sol:Identity'].interface;

let bytecode = '0x'+compiledContract.contracts['Identity.sol:Identity'].bytecode;
let bytecodeInJson = JSON.stringify({bytecode:bytecode})

console.log("Contract compiled")

if (!fs.existsSync(buildDirectory)){
    fs.mkdirSync(buildDirectory)
}

fs.writeFile(buildDirectory+"/Identity.abi.json", abi, function(err)
{
    if(err)
        return console.log(err);
    else
        console.log("Abi file created at "+buildDirectory+"/Identity.abi.json");
}); 

fs.writeFile(buildDirectory+"/Identity.bin.json",bytecodeInJson, function(err)
{
    if(err)
        return console.log(err);
    else
        console.log("Bytecode file created at "+buildDirectory+"/Identity.bin.json");
});
