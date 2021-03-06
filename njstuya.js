/**
 * Simple wrapper for tuyapi for use with openhab or command line
 * Added support for more devices through set command
 * npm install unparagoned/njsTuya
 * NEW CLOUD MODE
 * njstuya.js -mode cloud -user email -pass password -biz smart_life -code 44 -region eu -id 12312312312 COMMAND
 * OR add details to key.json
 * njstuya.js -mode cloud -id 12312312312 COMMAND
 * ** USE LOCAL LAN
 * node njstuya.js args COMMAND
 * node njstuya.js -ip 192.168.x.x -id 1231204564df -key dsf456sdf COMMAND
 * node njstuya.js -id 1231204564df -get "{ \"schema\": true }"
 * node njstuya.js -ip 192.168.x.x -id 1231204564df -key dsf456sdf -set "{ \"dps\": 1, \"set\": true }"
 * COMMAND: ON, OFF, or TOGGLE.
 * DEBUG MODE
 * DEBUG=* node node njstuya.js
 * */

const debug = require('debug')('njstuya');
const CloudTuya = require('cloudtuya');
const TuyaDevice = require('tuyapi');

const name = 'njstuya';

debug('booting %s', name);
const args = process.argv.slice(2);

function print(text) {
  // eslint-disable-next-line no-console
  console.log(text);
}

function getArgs(allArgs, argName) {
  const nameIndex = allArgs.indexOf(argName);
  let argValue = '';
  if(nameIndex >= 0) {
    argValue = allArgs[nameIndex + 1];
    argValue = (argValue !== undefined ? argValue.replace(/'/g, '') : argValue);
    debug(`"{argName} value is: ${argValue}`);
  }
  return argValue;
}
const tuyaIP = getArgs(args, '-ip');
const tuyaID = getArgs(args, '-id');
let tuyaKey = getArgs(args, '-key');
const tuyaSet = getArgs(args, '-set');
const tuyaSetM = getArgs(args, '-multi');
const tuyaGet = getArgs(args, '-get');
let tuyaResolve = getArgs(args, '-res');
const tuyaUser = getArgs(args, '-user');
const tuyaPass = getArgs(args, '-pass');
const tuyaBiz = getArgs(args, '-biz');
const tuyaCountryCode = getArgs(args, '-code');
const tuyaRegion = getArgs(args, '-region');
let tuyaMode = getArgs(args, '-mode');

// cloud or local

if(tuyaResolve === undefined || tuyaResolve.includes('true')) tuyaResolve = true;
else tuyaResolve = ((tuyaResolve.includes('false') ? false : tuyaResolve));


function getKey() {
  try{
    const key = require('./key.json');
    return key;
  } catch(err) {
    return{};
  }
}
const apiKey = getKey();


if(tuyaMode.length === 0) {
  if(tuyaKey.length === 0 && args.length > 0) {
    if((tuyaUser.length > 0 && tuyaPass.length > 0) || apiKey.undefined) {
      tuyaMode = 'cloud';
    } else{
      tuyaMode = 'local';
      debug('local mode');
    }
  } else{
    tuyaMode = 'local';
  }
}


if(tuyaKey.length === 0) {
  tuyaKey = '1000000000000000';
}

let tuya;
try{
  tuya = new TuyaDevice({
    id: tuyaID,
    key: tuyaKey,
    ip: tuyaIP,
    resolve: tuyaResolve,
    // persistentConnection: false,
  });
} catch(error) {
  print(`caught error: ${error.toString()}`);
}
let api = {};
debug(`api ${JSON.stringify(apiKey)} or ${apiKey.userName}`);
if(tuyaMode === 'cloud') {
  api = new CloudTuya({
    userName: apiKey.userName || tuyaUser,
    password: apiKey.password || tuyaPass,
    bizType: apiKey.bizType || tuyaBiz,
    countryCode: apiKey.countryCode || tuyaCountryCode,
    region: apiKey.region || tuyaRegion,
  });
}


function bmap(istate) {
  if(typeof istate !== typeof true) return istate;
  return istate ? 'ON' : 'OFF';
}

function cState(istate) {
  return((istate === 1) && true) || false;
}

function parseState(setString) {
  if(setString.includes('true')) return true;
  return false;
}

function isCommand(command) {
  return(args.includes(command)
    || args.includes(command.toUpperCase())
    || args.includes(command.toLowerCase()));
}

async function getState() {
  let dps;
  if(tuyaGet.length > 0) {
    dps = JSON.parse(tuyaGet);
  }
  return tuya.get(dps).then(status => status, (reason) => {
    print(reason.toString());
  });
}

// Sets new state and returns new state for one dps setting
// example of use:  -set { "dps": 1, "set": true } or
// example of use:  -set { "dps": 7, "set": true }
// Sets new state and returns new state
async function setState(iState) {
  let state = iState;
  let stateObj = {
    set: state,
  };
  if(tuyaSet.length > 0) {
    state = parseState(tuyaSet);
    stateObj = JSON.parse(tuyaSet);
  }
  debug(`new state:${JSON.stringify(stateObj)}`);

  await tuya.set(stateObj).then((result) => {
    debug(`Result of setting status to ${JSON.stringify(stateObj)}: ${result}`);
    if(result) {
      print(bmap(state));
    } else{
      print(bmap(!state));
    }
  }, (reason) => {
    print(`${reason.toString()} - Try without IP to auto resolve IP`);
  });
}
// Sets Multiple dps settings so it will set new states and returns new states
// tuyapi v4.0.4 docs at URL: https://codetheweb.github.io/tuyapi/index.html
// example of use:  -setm { "1": true, "7": true }
// example of use:  -setm { "7": true }
// example of use:  -setm { "1": true, "2": "scene_1" }
// example of use:  -setm { "2": "scene_1" }
// example of use:  -setm { "1": true, "2": "scene", "6": "3a59bd00e2afbc" }
// example of use:  -setm { "2": "scene", "6": "3a59bd00e2afbc" }
// example of use:  -setm { "1": true, "2": "colour", "5": "ff0033015cffff" }
// example of use:  -setm { "2": ,"colour", "5": "ff0033015cffff" }
// example of use:  -setm { "1': true, "2": "white", "3": 255, "4": 255 }
// example of use:  -setm { "2": "white", "3": 27, "4": 255 }
// example of user: -setm { "2": "white", "3": 255 }
async function setStateM(iStateM) {
  let multiple_state = iStateM;
  let stateObjM = {
    multiple: true,
    data: multiple_state,
  };
  if(tuyaSetM.length > 0) {
    multiple_state = parseState(tuyaSetM);
    const objM = JSON.parse(tuyaSetM);
    stateObjM = {
      multiple: true,
      data: objM,
    };
  }
  debug(`new multiple dps set states:${JSON.stringify(stateObjM)}`);

  await tuya.set(stateObjM).then((resultM) => {
    debug(`Result of multiple dps settings set to ${JSON.stringify(stateObjM)}: ${resultM}`);
    if(resultM) {
      print(bmap(multiple_state));
    } else{
      print(bmap(!multiple_state));
    }
  }, (reasonM) => {
    print(`${reasonM.toString()} - Try without IP to auto resolve IP`);
  });
}

async function setStateCloud(iState) {
  const resp = await api.setState({
    devId: tuyaID,
    setState: iState,
  });
  const status = cState(iState);
  if(resp.header.code === 'SUCCESS') {
    print(bmap(status));
  } else print(bmap(status));
}

async function runCloud() {
  const tokens = await api.login();
  debug(`Token ${JSON.stringify(tokens)}`);


  if(isCommand('On')) {
    await setStateCloud(1);
  } else if(isCommand('Off')) {
    await setStateCloud(0);
  } else if(isCommand('-Set')) throw new Error('Set not available on cloud yet');
  else if(isCommand('-multi')) throw new Error('Multi not available on cloud');
  else{
  // Get state of a single device
    const deviceStates = await api.state({
      devId: tuyaID,
    });
    const status = ((tuyaID.length > 0) && deviceStates[tuyaID]) || deviceStates;

    if(isCommand('Toggle')) {
      let newState = 1;
      debug(`status ${status} + ${status.includes('ON')}`);
      if(status.includes('ON')) {
        newState = 0;
      }
      setStateCloud(newState);
    } else{
      if(isCommand('-Get')) throw new Error('Set not available on cloud yet');
      // Shows state for all gets status or toggle
      debug(`Status: ${status}`);
      print(status);
    }
  }
}


async function runLocal() {
  // Promise is probably redundant
  return new Promise(async (resolve, reject) => {
    // Disconnect after 10 seconds
    const tuyaTimeout = setTimeout(() => {
      tuya.disconnect();
      reject();
    }, 10000);
    // Runs the logic converting CLI to commands
    const runCommand = async (initState) => {
      debug(`runCommand has started with data ${JSON.stringify(initState)}`);
      // tuya.removeListener('data', runCommand);
      // tuya.removeListener is no longer available in tuyapi 4.0.4 if has be depreciated
      // tuya.removeListener('data', runCommand);
      // check to see which switch was used -set or -multi if both used default to -set only
      let status = initState.dps['1'];
      if(tuyaSet.length > 0) {
      // Ignore initial response if user is using dps
        if(isCommand('On')) await setState(true);
        else if(isCommand('Off')) await setState(false);
        else if(isCommand('-Set')) await setState(JSON.parse(tuyaSet));
        else if(isCommand('Toggle')) await setState(!status);
        else{
          if(isCommand('-Get')) status = await getState();
          // Shows state for all gets status or toggle
          debug(`Status: ${status}`);
          print(bmap(status));
        }
        tuya.disconnect();
        clearTimeout(tuyaTimeout);
        resolve();
      } else if(tuyaSetM.length > 0) {
        status = initState.dps['1'];
        if(isCommand('-multi')) await setStateM(JSON.parse(tuyaSetM));
        tuya.disconnect();
        clearTimeout(tuyaTimeout);
        resolve();
      }
    };

    // Add event listeners
    // Connect auto gets state so put main logic into the listner.
    tuya.on('data', runCommand);

    tuya.on('connected', () => {
      debug('Connected to device!');
    });

    tuya.on('disconnected', () => {
      debug('Disconnected from device.');
    });

    tuya.on('error', (error) => {
      debug('Error!', error);
    });
    // Resolve Missing IDs/IPS or resolve full network
    if(tuyaIP.length === 0 && tuyaID.length === 0) {
      // Logic for my branch and new refactored tuyapi
      const devices = await (tuya.findDevices() || tuya.find());
      print(`{ "devices": [ ${JSON.stringify(devices)} ] }`);
      resolve(devices);
      clearTimeout(tuyaTimeout);
      return;
    }
    if(tuyaIP.length < 4 || tuyaID.length < 4) {
      // Logic for my branch and new refactored tuyapi
      const device = await (tuya.find() || tuya.resolveId());
      debug(`ip ${device.ip} id: ${device.id}`);
    }
    await tuya.connect();
  });
}
/* Main function which gets and sets state according to input
 */
function main() {
  if(tuyaMode.includes('cloud')) runCloud();
  else runLocal();
}
main();
