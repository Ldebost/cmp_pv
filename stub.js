/**
 * == STUB ==
 * Stock les messages envoyés au CMP en attendant son chargement
 * Doc : https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 **/
(function () {
    var gdprAppliesGlobally = false;

    function addFrame() {
        if (!window.frames['__tcfapiLocator']) {
            if (document.body) {
                var body = document.body,
                    iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.name = '__tcfapiLocator';
                body.appendChild(iframe);
            } else {
                // In the case where this stub is located in the head,
                // this allows us to inject the iframe more quickly than
                // relying on DOMContentLoaded or other events.
                setTimeout(addFrame, 5);
            }
        }
    }

    addFrame();

    function __tcfapi(command, version, callback, parameter) {
        __tcfapi.a = __tcfapi.a || [];
        if (command === 'ping') {
            callback({"gdprAppliesGlobally": gdprAppliesGlobally, "cmpLoaded": false}, true);
        } else {
            __tcfapi.a.push({
                command: command,
                version: version,
                parameter: parameter,
                callback: callback
            });
        }
    }

    function postMessageEventHandler(event) {
        var msgIsString = typeof event.data === "string";
        var json;
        if (msgIsString) {
            json = event.data.indexOf("__tcfapiCall") !== -1 ? JSON.parse(event.data) : {};
        } else {
            json = event.data;
        }
        if (json.__tcfapiCall) {
            var i = json.__tcfapiCall;
            window.__tcfapi(i.command, i.parameter, function (retValue, success) {
                var returnMsg = {
                    "__tcfapiReturn": {
                        "returnValue": retValue,
                        "success": success,
                        "callId": i.callId
                    }
                };
                try {
                    event.source.postMessage(msgIsString ? JSON.stringify(returnMsg) : returnMsg, '*');
                } catch (e) {
                }
            });
        }
    }

    // if (typeof (__tcfapi) !== 'function') {
    window.__tcfapi = __tcfapi;
    if (window.addEventListener)
        window.addEventListener('message', postMessageEventHandler, false);
    else window.attachEvent('onmessage', postMessageEventHandler);
    // }
})();