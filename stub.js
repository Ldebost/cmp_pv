/**
 * == STUB ==
 * Stock les messages envoyés au CMP en attendant son chargement
 * Doc : https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 **/
(function() {
	var gdprAppliesGlobally = false;

	function addFrame() {
		if (!window.frames['__cmpLocator']) {
			if (document.body) {
				var body = document.body,
					iframe = document.createElement('iframe');
				iframe.style = 'display:none';
				iframe.name = '__cmpLocator';
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

	function stubCMP(command, parameter, callback) {
		__cmp.a = __cmp.a || [];
		if (command === 'ping') {
			callback({"gdprAppliesGlobally": gdprAppliesGlobally, "cmpLoaded": false}, true);
		}
		else {
			__cmp.a.push({
				command: command,
				parameter: parameter,
				callback: callback
			});
		}
	}

	function cmpMsgHandler(event) {
		var msgIsString = typeof event.data === "string";
		var json;
		if (msgIsString) {
			json = event.data.indexOf("__cmpCall") !== -1 ? JSON.parse(event.data) : {};
		} else {
			json = event.data;
		}
		if (json.__cmpCall) {
			var i = json.__cmpCall;
			window.__cmp(i.command, i.parameter, function(retValue, success) {
				var returnMsg = {
					"__cmpReturn": {
						"returnValue": retValue,
						"success": success,
						"callId": i.callId
					}
				};
				event.source.postMessage(msgIsString ? JSON.stringify(returnMsg) : returnMsg, '*');
			});
		}
	}

	if (typeof (__cmp) !== 'function') {
		window.__cmp = stubCMP;
		__cmp.msgHandler = cmpMsgHandler;
		if (window.addEventListener)
			window.addEventListener('message', cmpMsgHandler, false);
		else window.attachEvent('onmessage', cmpMsgHandler);
	}
})();