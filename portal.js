var host = (window && window.location && window.location.hostname) || '';
var parts = host.split('.');
var COOKIE_DOMAIN = parts.length > 1 ? ";domain=." + parts.slice(-2).join('.') : '';
var COOKIE_MAX_AGE = 33696000;
var COOKIE_NAME = 'euconsent';

function readCookie(name) {
	var value = '; ' + document.cookie;
	var parts = value.split('; ' + name + '=');
	if (parts.length === 2) {
		return parts.pop().split(';').shift();
	}
}

function writeCookie(obj) {
	document.cookie = obj.name + "=" + obj.value + COOKIE_DOMAIN + ";path=" + obj.path + ";max-age=" + COOKIE_MAX_AGE;
	return true;
}

var commands = {
	readVendorConsent: function() {
		return readCookie(COOKIE_NAME);
	},

	writeVendorConsent: function(data) {
		return writeCookie({name: COOKIE_NAME, value: data.encodedValue, path: '/'});
	}
};

window.addEventListener('message', function(event) {
	var data = event.data.vendorConsent;
	if (data && typeof commands[data.command] === 'function') {
		var result = commands[data.command](data);
		event.source.postMessage({
			vendorConsent: Object.assign(
				data,
				{result: result}
			)
		}, event.origin);
	}
});
window.parent.postMessage({vendorConsent: {command: 'isLoaded'}}, '*');
