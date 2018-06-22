/**
 * == CMP ==
 **/
var cmp_pv = {
	/** Interface **/
	isLoaded: false,
	cmpReady: false,
	commandQueue: window.__cmp.a || {},
	processCommand: function(command, parameter, callback){
		if (typeof cmp_pv.commands[command] !== 'function') {
			console.error("Invalid CMP command %s,", command);
		}
		if(!cmp_pv.cmpReady && command !== 'init'){
			cmp_pv.commandQueue.push({
				command: command,
				parameter: parameter,
				callback: callback
			});
		}else{
			console.info("Proccess command: %s, parameter: %s", command ,parameter);
			cmp_pv.commands[command](parameter, callback);
		}
	},
	processCommandQueue: function(){
		var queue = this.commandQueue;
		if (queue.length) {
			console.info("Process %d queued commands", queue.length);
			cmp_pv.commandQueue = [];
			for(var i=0; i<queue.length; i++){
				/*// If command is queued with an event we will relay its result via postMessage
				if (event) {
					this.processCommand(command, parameter, returnValue =>
						event.source.postMessage({
							__cmpReturn: {
								callId,
								command,
								returnValue
							}
						}, event.origin));
				}
				else {*/
				cmp_pv.processCommand(queue[i].command, queue[i].parameter, queue[i].callback);
				//}
			}
		}
	},

	/** Configuration **/
	conf:{
		gdprApplies: true,
		hasGlobalScope: false,
	},

	/** Commandes **/
	commands: {
		init: function () {
			if(cmp_pv.ui.dom !== null) return cmp_pv.ui.show();

			//
			return Promise.all([
				cmp_pv._fetchGlobalVendorList()
			]).then(function(){
				// Load consent
				cmp_pv.cookie.loadConsent();

				// Create UI
				cmp_pv.ui.dom = document.createElement('div');
				cmp_pv.ui.dom.id = "CMP";
				cmp_pv.ui.dom.style.display = 'none';

				var html = ''; 
				html += '<div id="step1">';
				html += '	<p>Nos partenaires et nous-mêmes utilisons différentes technologies, telles que les cookies, pour personnaliser les contenus et les publicités, proposer des fonctionnalités sur les réseaux sociaux et analyser le trafic. Merci de cliquer sur le bouton ci-dessous pour donner votre accord. Vous pouvez changer d’avis et modifier vos choix à tout moment.</p>';
				html += '	<a href="javascript:cmp_pv.cookie.saveConsent();">J\'ACCEPTE</a>';
				html += '	<a href="javascript:cmp_pv.ui.showStep(2);">Afficher toutes les utilisations prévues</a>';
				html += '</div>';
				html += '<div id="step2" style="display: none;">';
				html += '	<div>';
				html += '		<a href="javascript:cmp_pv.ui.showStep(1);">&lsaquo; Retour</a>';
				html += '	</div>';
				html += '	<div>';
				html += '		<ul>';
				for(var i = 0; i<cmp_pv.globalVendorList.purposes.length; i++){
					html += '			<li>';
					html += '				<h4>'+ cmp_pv.globalVendorList.purposes[i].name +'</h4>';
					html += '				<p>'+ cmp_pv.globalVendorList.purposes[i].description +'</p>';
					html += '			</li>';
				}
				html += '		</ul>';
				html += '	</div>';
				html += '</div>';
				html += '<div id="step3" style="display: none;">';
				html += '</div>';
				cmp_pv.ui.dom.innerHTML = html;
				document.body.appendChild(cmp_pv.ui.dom);

				// ready
				cmp_pv.cmpReady = true;
				cmp_pv.processCommandQueue();
			})
		},

		getVendorConsents: function (vendorIds, callback) {
			var consent = {
				metadata: cmp_pv.consentString.generateVendorConsentMetadata(),
				gdprApplies: cmp_pv.conf.gdprApplies,
				hasGlobalScope: cmp_pv.conf.hasGlobalScope,
				purposeConsents: cmp_pv.consentString.data.purposesAllowed,
				vendorConsents: cmp_pv.consentString.data.bitField,
			};

			callback(consent, true);
		},

		getConsentData: function (consentStringVersion, callback) {
			var consent = {
				consentData: cmp_pv.consentString.generateVendorConsentString(),
				gdprApplies: cmp_pv.conf.gdprApplies,
				hasGlobalScope: cmp_pv.conf.hasGlobalScope,
			};
			callback(consent, true);
		},

		ping: function (_, callback) {
			var result = {
				gdprAppliesGlobally: cmp_pv.conf.hasGlobalScope,
				cmpLoaded: true
			};
			callback(result, true);
		},

		getPublisherConsents: function (purposeIds, callback) {
			var consent = {
				metadata: '',
				gdprApplies: cmp_pv.conf.gdprApplies,
				hasGlobalScope: cmp_pv.conf.hasGlobalScope,
				standardPurposeConsents: cmp_pv.consentString.data.purposesAllowed,
				customPurposeConsents: cmp_pv.consentString.data.customPurposesAllowed,
			};
			callback(consent, true);
		},

		getVendorList: function (vendorListVersion, callback) {
			callback(cmp_pv.globalVendorList, (cmp_pv.globalVendorList != null));
		},

		showConsentUi: function (_, callback) {
			callback(cmp_pv.ui.show());
		},
	},

	/** UI **/
	ui: {
		dom: null,
		show: function(){
			if(cmp_pv.ui.dom === null){
				console.error("DOM UI is not present, please initialize ('init') before.");
				return false;
			}
			cmp_pv.ui.dom.style.display = 'block';
			return true;
		},
		showStep: function(step){
			for(var i = 1; i<4; i++){
				document.getElementById('step'+i).style.display = (i === step)?'block':'none';
			}
		}
	},

	/** Cookie **/
	cookie: {
		vendorCookieName: 'euconsent',
		publisherCookieName: 'eupubconsent',
		readCookie: function(name){
			var value = "; "+document.cookie;
			var parts = value.split("; "+name+"=");

			if (parts.length === 2) {
				return parts.pop().split(';').shift();
			}
		},
		writeCookie: function(name, value, maxAgeSeconds, path) {
			var maxAge = maxAgeSeconds === null ? '' : ";max-age="+maxAgeSeconds;
			document.cookie = name+"="+value+";path="+path+maxAge;
		},
		loadVendorCookie: function(){
			var data = this.readCookie(this.vendorCookieName);
			if("undefined" !== typeof data){
				return cmp_pv.consentString.decodeVendorConsentData(data);
			}
			return false;
		},
		loadPublisherCookie: function(){
			var data = this.readCookie(this.publisherCookieName);
			if("undefined" !== typeof data){
				return cmp_pv.consentString.decodePublisherConsentData(data);
			}
			return false;
		},
		writeVendorCookie: function(){
			var data = cmp_pv.consentString.generateVendorConsentString();
			if(cmp_pv.conf.hasGlobalScope){
				
			}else{
				this.writeCookie(this.vendorCookieName, data, 33696000, '/');	
			}
		},
		writePublisherCookie: function(){
			var data = cmp_pv.consentString.generatePublisherConsentString();
			this.writeCookie(this.publisherCookieName, data, 33696000, '/');
		},
		saveConsent: function(){
			cmp_pv.consentString.data.lastUpdated = new Date();
			this.writeVendorCookie();
			this.writePublisherCookie();
		},
		loadConsent: function(){
			if(!this.loadVendorCookie()){
				cmp_pv.consentString.data = cmp_pv.consentString.generateVendorConsentData();
			}
			if(!this.loadPublisherCookie()){
				
			}
		}
	},

	/** Consent String */
	consentString: {
		const:{
			VERSION_BIT_OFFSET: 0,
			VERSION_BIT_SIZE: 6,
			CMP_ID: 1,
			CMP_VERSION: 1,

			// Version 1
			vendor_1: [
				{ name: 'version', type: 'int', numBits: 6, default: 1 },
				{ name: 'created', type: 'date', numBits: 36, default: new Date() },
				{ name: 'lastUpdated', type: 'date', numBits: 36, default: new Date() },
				{ name: 'cmpId', type: 'int', numBits: 12, default: 1 },
				{ name: 'cmpVersion', type: 'int', numBits: 12, default: 1 },
				{ name: 'consentScreen', type: 'int', numBits: 6, default: 1 },
				{ name: 'consentLanguage', type: '6bitchar', numBits: 12, default: 'FR' },
				{ name: 'vendorListVersion', type: 'int', numBits: 12, default: function() { return cmp_pv.globalVendorList.vendorListVersion } },
				{ name: 'purposesAllowed', type: 'bits', numBits: 24, default: function(){ return cmp_pv.consentString.defaultBits(0, this.numBits)} },
				{ name: 'maxVendorId', type: 'int', numBits: 16, 
					default: function() {
						var maxVendorId = 1;
						for(var i=0; i<cmp_pv.globalVendorList.vendors.length; i++){
							if(cmp_pv.globalVendorList.vendors[i].id > maxVendorId) maxVendorId = cmp_pv.globalVendorList.vendors[i].id;
						}
						return maxVendorId;
					}
				},
				{ name: 'encodingType', type: 'bool', numBits: 1, default: false },
				{ name: 'bitField', type: 'bits', numBits: function(obj){ return obj.maxVendorId; }, validator: function(obj){ return !obj.encodingType; }, default: function(obj) { return cmp_pv.consentString.defaultBits(0, obj.maxVendorId);} },
				{ name: 'defaultConsent', type: 'bool', numBits: 1, validator: function(obj){ return obj.encodingType; }, default: false },
				{ name: 'numEntries', type: 'int', numBits: 12, validator: function(obj){ return obj.encodingType; }, default: 0 },
			],
			metadata_1: [
				{ name: 'version', type: 'int', numBits: 6 },
				{ name: 'created', type: 'date', numBits: 36 },
				{ name: 'lastUpdated', type: 'date', numBits: 36 },
				{ name: 'cmpId', type: 'int', numBits: 12 },
				{ name: 'cmpVersion', type: 'int', numBits: 12 },
				{ name: 'consentScreen', type: 'int', numBits: 6 },
				{ name: 'vendorListVersion', type: 'int', numBits: 12 },
				{ name: 'purposesAllowed', type: 'bits', numBits: 24 },
			],
			publisher_1: [
				{ name: 'version', type: 'int', numBits: 6, default: 1 },
				{ name: 'created', type: 'date', numBits: 36, default: new Date() },
				{ name: 'lastUpdated', type: 'date', numBits: 36, default: new Date() },
				{ name: 'cmpId', type: 'int', numBits: 12, default: this.CMP_ID },
				{ name: 'cmpVersion', type: 'int', numBits: 12, default: this.CMP_VERSION },
				{ name: 'consentScreen', type: 'int', numBits: 6, default: 1 },
				{ name: 'consentLanguage', type: '6bitchar', numBits: 12, default: 'FR' },
				{ name: 'vendorListVersion', type: 'int', numBits: 12, default: function() { return cmp_pv.globalVendorList.vendorListVersion } },
				{ name: 'publisherPurposesVersion', type: 'int', numBits: 12, default: 1 },
				{ name: 'standardPurposesAllowed', type: 'bits', numBits: 24, default: function() { return cmp_pv.consentString.defaultBits(0, this.numBits) } },
				{ name: 'numberCustomPurposes', type: 'int', numBits: 6, default: 0 },
				{ name: 'CustomPurposesBitField', type: 'bits', numBits: function(obj){ return obj.numberCustomPurposes; }, default: function() { return cmp_pv.consentString.defaultBits(0, obj.numberCustomPurposes) } },
			],

			// Autres
			VENDOR_ENCODING_RANGE: 1,
			SIX_BIT_ASCII_OFFSET: 65
		},
		data: {
			bitString: "",
			version: 1,
			created: null,
			lastUpdated: null,
			cmpId: null,
			cmpVersion: null,
			consentScreen: null,
			consentLanguage: null,
			vendorListVersion: null,
			purposesAllowed: [],
			maxVendorId: null,
			encodingType: null,
			bitField: [],
			defaultConsent: null,
			customPurposesAllowed: []
		},

		decodeVendorConsentData: function(cookieValue){
			return this.decodeCookieData('vendor_', cookieValue);
		},
		decodePublisherConsentData: function(cookieValue){
			return this.decodeCookieData('publisher_', cookieValue);
		},
		decodeCookieData: function(type, cookieValue){
			this.data.bitString = this.decodeBase64UrlSafe(cookieValue);
			var cookieVersion = this.decodeBitsToInt(this.const.VERSION_BIT_OFFSET, this.const.VERSION_BIT_SIZE);
			if (typeof cookieVersion !== 'number') {
				console.error('Could not find cookieVersion to decode');
				return false;
			}

			this.data = this.decodeConsentData(this.const[type+cookieVersion]);
			return true;
		},
		generateVendorConsentMetadata: function(){
			var inputBits = this.encodeConsentData(this.const['metadata_'+this.data.version]);
			return this.encodeBase64UrlSafe(inputBits);
		},
		generateVendorConsentString: function(){
			var inputBits = this.encodeConsentData(this.const['vendor_'+this.data.version]);
			return this.encodeBase64UrlSafe(inputBits);
		},
		generatePublisherConsentString: function(){
			var inputBits = this.encodeConsentData(this.const['publisher_'+this.data.version]);
			return this.encodeBase64UrlSafe(inputBits);
		},
		padLeft: function(string, padding) {
			return this.repeat(Math.max(0, padding), "0") + string;
		},
		padRight: function(string, padding) {
			return string + this.repeat(Math.max(0, padding), "0");
		},
		repeat: function(count, string) {
			var padString = '';
			for (var i = 0; i < count; i++) {
				padString += string;
			}
			return padString;
		},
		decodeBitsToInt: function(start, length) {
			return parseInt(this.data.bitString.substr(start, length), 2);
		},
		decodeBitsToDate: function(start, length) {
			return new Date(this.decodeBitsToInt(start, length) * 100);
		},
		decodeBitsToBool: function(start) {
			return parseInt(this.data.bitString.substr(start, 1), 2) === 1;
		},
		decode6BitCharacters: function(start, length) {
			var decoded = '';
			var decodeStart = start;
			while (decodeStart < start + length) {
				decoded += String.fromCharCode(this.const.SIX_BIT_ASCII_OFFSET + this.decodeBitsToInt(decodeStart, 6));
				decodeStart += 6;
			}
			return decoded;
		},
		decodeBase64UrlSafe: function(value){
			// Replace safe characters
			var unsafe = value
				.replace(/-/g, '+')
				.replace(/_/g, '/') + '=='.substring(0, (3 * value.length) % 4);

			var bytes = atob(unsafe);
			var bitString = "";
			for (var i = 0; i < bytes.length; i++) {
				var bitS = bytes.charCodeAt(i).toString(2);
				bitString += this.padLeft(bitS, 8 - bitS.length);
			}

			return bitString;
		},
		decodeConsentData: function(fields){
			var obj = {};
			var start = 0;
			for(var i=0; i<fields.length; i++){
				var field = fields[i];
				var length = ('function' === typeof field.numBits) ? field.numBits(obj) : field.numBits;
				switch (field.type) {
					case 'int':			obj[field.name] = this.decodeBitsToInt(start, length); break;
					case 'date':		obj[field.name] = this.decodeBitsToDate(start, length); break;
					case '6bitchar':	obj[field.name] = this.decode6BitCharacters(start, length); break;
					case 'bool':		obj[field.name] = this.decodeBitsToBool(start); break;
					case 'bits':
						var z = 1;
						obj[field.name] = {};
						for (var y = start; y < start+length; y++) {
							obj[field.name][z] = this.decodeBitsToBool(y);
							z++;
						}
						break;
					default:
						console.warn("Cookie definition field found without encoder or type: %s", field.name);
				}

				start += length;
			}

			return obj;
		},
		encodeIntToBits: function(number, numBits) {
			var bitString = '';
			if (typeof number === 'number' && !isNaN(number)) {
				bitString = parseInt(number, 10).toString(2);
			}

			// Pad the string if not filling all bits
			if (numBits >= bitString.length) {
				bitString = this.padLeft(bitString, numBits - bitString.length);
			}

			// Truncate the string if longer than the number of bits
			if (bitString.length > numBits) {
				bitString = bitString.substring(0, numBits);
			}
			return bitString;
		},
		encodeBoolToBits: function(value) {
			return this.encodeIntToBits(value === true ? 1 : 0, 1);
		},
		encodeDateToBits: function(date, numBits) {
			if (date instanceof Date) {
				return this.encodeIntToBits(date.getTime() / 100, numBits);
			}
			return this.encodeIntToBits(date, numBits);
		},
		encode6BitCharacters: function(string, numBits) {
			var encoded = typeof string !== 'string' ? '' : string.split('').map(function(char){
				var int = Math.max(0, char.toUpperCase().charCodeAt(0) - cmp_pv.consentString.const.SIX_BIT_ASCII_OFFSET);
				return cmp_pv.consentString.encodeIntToBits(int > 25 ? 0 : int, 6);
			}).join('');
			return this.padRight(encoded, numBits).substr(0, numBits);
		},
		encodeBase64UrlSafe: function(binaryValue){
			// Pad length to multiple of 8
			var paddedBinaryValue = this.padRight(binaryValue, 7 - (binaryValue.length + 7) % 8);

			// Encode to bytes
			var bytes = '';
			for (var i = 0; i < paddedBinaryValue.length; i += 8) {
				bytes += String.fromCharCode(parseInt(paddedBinaryValue.substr(i, 8), 2));
			}

			// Make base64 string URL friendly
			return btoa(bytes)
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/, '');
		},
		encodeConsentData: function(fields){
			var inputBits = "";
			for(var i=0; i<fields.length; i++){
				var field = fields[i];
				if('function' === typeof field.validator && !field.validator(this.data)) continue;
				var length = ('function' === typeof field.numBits) ? field.numBits(this.data) : field.numBits;
				switch (field.type) {
					case 'int':			inputBits += this.encodeIntToBits(this.data[field.name], length); break;
					case 'date':		inputBits += this.encodeDateToBits(this.data[field.name], length); break;
					case '6bitchar':	inputBits += this.encode6BitCharacters(this.data[field.name], length); break;
					case 'bool':		inputBits += this.encodeBoolToBits(this.data[field.name]); break;
					case 'bits':
						var data = this.data[field.name];
						for (var y = 1; y <= length; y++) {
							inputBits += this.encodeBoolToBits(data[y]);
						}
						break;
					default:
						console.warn("Cookie definition field found without encoder or type: %s", field.name);
				}
			}
			return inputBits;
		},
		defaultBits: function(val, numBits){
			var obj = {};
			for(var i=1; i<=numBits; i++){
				obj[i] = val;
			}
			return obj;
		},
		generateConsentData: function(fields){
			var obj = {};
			for(var i=0; i<fields.length; i++){
				var field = fields[i];
				obj[field.name] = ('function' === typeof field.default)?field.default(obj):field.default;
			}
			return obj;
		},
		generateVendorConsentData: function(){
			return this.generateConsentData(this.const['vendor_'+this.data.version]);
		}
	},

	/** **/
	_fetchGlobalVendorList: function(){
		return cmp_pv._fetch("https://vendorlist.consensu.org/vendorlist.json").then(function(res){
			if (res.status === 200) {
				cmp_pv.globalVendorList = JSON.parse(res.responseText);
			} else {
				console.error("Can't fetch vendorlist: %d (%s)", res.status, res.statusText);
			}
		});
	},

	_fetchPubVendorList: function(){
		return cmp_pv._fetch("/.well-known/pubvendors.json").then(function(res){
			if (res.status === 200) {
				cmp_pv.pubvendor = JSON.parse(res.responseText);
			} else {
				console.error("Can't fetch pubvendors: %d (%s)", res.status, res.statusText);
			}
		});
	},

	_fetch: function(url){
		return new Promise(function (resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function(e){
				if (this.readyState === XMLHttpRequest.DONE) {
					resolve(this);
				}
			};
			xhr.open("GET", url, true);
			xhr.send();
		});
	}
};

window.__cmp = cmp_pv.processCommand;
cmp_pv.processCommandQueue();
