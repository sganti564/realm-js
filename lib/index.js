////////////////////////////////////////////////////////////////////////////
//
// Copyright 2016 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////

'use strict';

const require_method = require;

// Prevent React Native packager from seeing modules required with this
function nodeRequire(module) {
    return require_method(module);
}

function getContext() {
    // If process is an object, we're probably running in Node or Electron
    // From: http://stackoverflow.com/a/24279593/1417293
    if (typeof process === 'object' && process + '' === '[object process]') {

        // Visual Studio Code defines the global.__debug__ object.
        if (typeof global !== 'undefined' && global.__debug__) {
            return 'vscodedebugger';
        }

        return process.type === 'renderer' ? 'electron' : 'node.js';
    }

    // When running via Jest, the jest object is defined.
    if (typeof jest === 'object') {
        return 'node.js';
    }

    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') { // eslint-disable-line no-undef
        // If the navigator.userAgent contains the string "Chrome", we're likely
        // running via the chrome debugger.
        if (typeof navigator !== 'undefined' &&
            /Chrome/.test(navigator.userAgent)) { // eslint-disable-line no-undef
            return 'chromedebugger';
        }

        // Check if its in remote js debugging mode
        // https://stackoverflow.com/a/42839384/3090989
        if (typeof atob !== 'undefined') {
            return 'chromedebugger';
        }

        // Otherwise, we must be in a "normal" react native situation.
        // In that case, the Realm type should have been injected by the native code.
        // If it hasn't, the user likely forgot to run link.
        if (typeof Realm === 'undefined'){
            throw new Error('Missing Realm constructor. Did you run "react-native link realm"? Please see https://realm.io/docs/react-native/latest/#missing-realm-constructor for troubleshooting');
        }
        return 'reactnative';
    }

    // If we're not running in React Native but we already injected the Realm class,
    // we are probably running in a pure jscore environment
    if (typeof Realm !== 'undefined') {
        return 'jscore';
    }

    // Visual Studio Code defines the global.__debug__ object.
    if (typeof global !== 'undefined' && global.__debug__) {
        return 'vscodedebugger';
    }

    // Finally, if the navigator.userAgent contains the string "Chrome", we're likely
    // running via the chrome debugger, even if navigator.product isn't set to "ReactNative"
    if (typeof navigator !== 'undefined' &&
        /Chrome/.test(navigator.userAgent)) { // eslint-disable-line no-undef
        return 'chromedebugger';
    }

    throw Error("Unknown execution context");
}

function createUserAgentDescription() {
    // Detect if in ReactNative (running on a phone) or in a Node.js environment
    // Credit: https://stackoverflow.com/questions/39468022/how-do-i-know-if-my-code-is-running-as-react-native
    try {
        var userAgent = "RealmJS/";
        var context = getContext();
        userAgent = userAgent + require('../package.json').version + " (" + context + ", ";
        if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
            // Running on ReactNative
            const Platform = require('react-native').Platform;
            userAgent += Platform.OS + ", v" + Platform.Version;
        } else {
            // Running on a normal machine
            userAgent += process.version;
        }
        return userAgent += ")";
    } catch (e) {
        return "RealmJS/Unknown"
    }
}


var realmConstructor;

const context = getContext();
switch(context) {
    case 'node.js':
    case 'electron':
        nodeRequire('./submit-analytics')('Run', context);

        var binary = nodeRequire('node-pre-gyp');
        var path = nodeRequire('path');
        var pkg = path.resolve(path.join(__dirname,'../package.json'));
        var binding_path = binary.find(pkg);

        realmConstructor = require_method(binding_path).Realm;
        break;

    case 'reactnative':
    case 'jscore':
        realmConstructor = Realm;  // eslint-disable-line no-undef
        break;

    case 'chromedebugger':
    case 'vscodedebugger':
        realmConstructor = require('./browser').default; // (exported as ES6 module)
        break;
}

if (!realmConstructor) {
    throw Error("Error trying to establish execution context");
}

require('./extensions')(realmConstructor);

if (realmConstructor.Sync) {
    if (context === 'node.js') {
      nodeRequire('./notifier')(realmConstructor);
      if (!realmConstructor.Worker) {
          Object.defineProperty(realmConstructor, 'Worker', {value: nodeRequire('./worker')});
      }
    }
    realmConstructor.Sync._initializeSyncManager(createUserAgentDescription());
}

module.exports = realmConstructor;
