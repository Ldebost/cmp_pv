/**
 * == CMP ==
 **/
var cmp_pv = {
	/** Interface **/
	isLoaded: false,
	cmpReady: false,
	lastEvent: '',
	commandQueue: window.__tcfapi.a || [],
	googleACList: [],
	processCommand: function (command, version, callback, parameter) {
		if (typeof cmp_pv.commands[command] !== 'function') {
			console.error("Invalid CMP command %s", command);
		}
		if (!cmp_pv.cmpReady && command !== 'init' && command !== 'ping') {
			cmp_pv.commandQueue.push({
				command: command,
				version: version,
				parameter: parameter,
				callback: callback
			});
		} else {
			console.info("Proccess command: %s, parameter: %s", command, parameter);
			cmp_pv.commands[command](parameter, callback);
		}
	},

	processCommandQueue: function () {
		var queue = this.commandQueue;
		if (queue.length) {
			console.info("Process %d queued commands", queue.length);
			cmp_pv.commandQueue = [];
			for (var i = 0; i < queue.length; i++) {
				cmp_pv.processCommand(queue[i].command, queue[i].version, queue[i].callback, queue[i].parameter);
			}
		}
	},

	/** Configuration **/
	conf: {
		gdprApplies: true,
		hasGlobalScope: false,
		cookieDomain: 'paruvendu.fr',
		cookieSecure: true,
		publisherName: 'ParuVendu.fr',
		urlVendorList: 'https://media-recette.paruvendu.fr/vendor-list-v2.json?[RND]',
		urlCookiesUsage: 'https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#cookies',
		dayCheckInterval: 30,
		globalConsentLocation: 'https://paruvendu.mgr.consensu.org/portal.html',
		uiColor: '#EE1C24',
		firstScreenPurposes: {
			"purposes": [1, 3],
			"stacks": [31],
			"specialFeatures": [1, 2]
		},
		googleAC: true,
		urlGoogleACList: 'https://media-recette.paruvendu.fr/vendor-list-v0.json?[RND]'
	},

	/** Commandes **/
	commands: {
		init: function (options) {
			// Options
			cmp_pv.conf = Object.assign(cmp_pv.conf, options);

			// Already loaded
			if (cmp_pv.ui.dom !== null) return cmp_pv.ui.show(true);

			// Load consent
			cmp_pv.cookie.loadConsent(function (res) {
				// Not ready
				if (!res) {
					cmp_pv.ui.show(true);
				} else {
					// Ready
					cmp_pv.cmpReady = true;
					cmp_pv.processCommandQueue();
					// Ask consent every X days if globalVendorList.version has changed
					if (parseInt((new Date() - cmp_pv.cookie.lastVerification(cmp_pv.cookie.vendorCookieName)) / (24 * 3600 * 1000)) >= cmp_pv.conf.dayCheckInterval) {
						cmp_pv._fetchGlobalVendorList(function () {
							if (cmp_pv.globalVendorList.vendorListVersion !== cmp_pv.consentString.data.coreString.vendorListVersion) {
								cmp_pv.ui.show(true);
							}
						});

						// Update checked time
						cmp_pv.cookie.saveVerification(cmp_pv.cookie.vendorCookieName);
					} else {
						// Fire tcloaded event
						cmp_pv.event.send('tcloaded');
					}
				}
			});
		},

		ping: function (_, callback) {
			callback({
				gdprApplies: cmp_pv.conf.gdprApplies,
				cmpLoaded: true,
				cmpStatus: (cmp_pv.cmpReady) ? 'loaded' : 'loading',
				displayStatus: (cmp_pv.ui.dom != null && cmp_pv.ui.dom.style.display === 'block') ? 'visible' : 'hidden',
				apiVersion: "2.0",
				cmpVersion: cmp_pv.consentString.data.coreString.cmpVersion,
				cmpId: cmp_pv.consentString.const.CMP_ID,
				gvlVersion: cmp_pv.consentString.data.coreString.vendorListVersion,
				tcfPolicyVersion: 2
			});
		},

		showConsentUi: function (_, callback) {
			var res = cmp_pv.ui.show(true);
			if (typeof callback !== 'undefined') callback(res);
		},

		getTCData: function (vendorIds, callback) {
			var vendorList, vendorLIList;
			if (vendorIds && vendorIds.length) {
				vendorList = vendorLIList = {};
				for (var i = 0; i < vendorIds.length; i++) {
					vendorList[vendorIds[i]] = cmp_pv.consentString.data.coreString.vendorConsent.bitField[vendorIds[i]];
					vendorLIList[vendorIds[i]] = cmp_pv.consentString.data.coreString.vendorLegitimateInterest.bitField[vendorIds[i]];
					if (typeof vendorList[vendorIds[i]] === 'undefined') vendorList[vendorIds[i]] = false;
					if (typeof vendorLIList[vendorIds[i]] === 'undefined') vendorLIList[vendorIds[i]] = false;
				}
			} else {
				vendorList = cmp_pv.consentString.data.coreString.vendorConsent.bitField;
				vendorLIList = cmp_pv.consentString.data.coreString.vendorLegitimateInterest.bitField
			}

			var consent = {
				tcString: cmp_pv.consentString.getConsentString(),
				tcfPolicyVersion: 2,
				cmpId: cmp_pv.consentString.const.CMP_ID,
				cmpVersion: cmp_pv.consentString.data.coreString.cmpVersion,

				/**
				 * true - GDPR Applies
				 * false - GDPR Does not apply
				 * undefined - unknown whether GDPR Applies
				 * see the section: "What does the gdprApplies value mean?"
				 */
				gdprApplies: cmp_pv.conf.gdprApplies,

				/**
				 * true - if using a service-specific or publisher-specific TC String
				 * false - if using a global TC String.
				 */
				isServiceSpecific: !cmp_pv.conf.hasGlobalScope,

				/**
				 * tcloaded
				 * cmpuishown
				 * useractioncomplete
				 */
				eventStatus: cmp_pv.lastEvent,

				/**
				 * true - CMP is using publisher-customized stack descriptions
				 * false - CMP is NOT using publisher-customized stack descriptions
				 */
				useNonStandardStacks: false,

				/**
				 * Country code of the country that determines the legislation of
				 * reference.  Normally corresponds to the country code of the country
				 * in which the publisher's business entity is established.
				 */
				publisherCC: 'FR',

				/**
				 * Only exists on service-specific TC
				 *
				 * true - Purpose 1 not disclosed at all. CMPs use PublisherCC to
				 * indicate the publisher's country of establishment to help vVendors
				 * determine whether the vendor requires Purpose 1 consent.
				 *
				 * false - There is no special Purpose 1 treatmentstatus. Purpose 1 was
				 * disclosed normally (consent) as expected by TCF Policy
				 */
				purposeOneTreatment: false,

				/**
				 * Only exists on global-scope TC
				 */
				outOfBand: {
					allowedVendors: {

						/**
						 * true - Vendor is allowed to use and Out-of-Band Legal Basis
						 * false - Vendor is NOT allowed to use an Out-of-Band Legal Basis
						 */
						//'[vendor id]': Boolean
					},
					disclosedVendors: {

						/**
						 * true - Vendor has been disclosed to the user
						 * false - Vendor has been disclosed to the user
						 */
						//'[vendor id]': Boolean
					}
				},
				purpose: {
					consents: cmp_pv.consentString.data.coreString.purposesConsent,
					legitimateInterests: cmp_pv.consentString.data.coreString.purposesLITransparency
				},
				vendor: {
					consents: vendorList,
					legitimateInterests: vendorLIList
				},
				specialFeatureOptins: cmp_pv.consentString.data.coreString.specialFeatureOptIns,
				publisher: {
					consents: cmp_pv.consentString.data.publisherTC.pubPurposesConsent,
					legitimateInterests: cmp_pv.consentString.data.publisherTC.pubPurposesLITransparency,
					customPurpose: {
						consents: cmp_pv.consentString.data.publisherTC.customPurposesConsent,
						legitimateInterests: cmp_pv.consentString.data.publisherTC.customPurposesLITransparency
					},
					restrictions: {

						/*'[purpose id]': {

							/!**
							 * 0 - Not Allowed
							 * 1 - Require Consent
							 * 2 - Require Legitimate Interest
							 *!/
							'[vendor id]': 1
						}*/
					}
				}
			};

			if (cmp_pv.conf.googleAC) consent.addtlConsent = cmp_pv.consentString.data.acString;

			callback(consent, true)
		},

		addEventListener: function (_, callback) {
			cmp_pv.event.listeners.push(callback);
			cmp_pv.event.send((cmp_pv.ui.dom != null && cmp_pv.ui.dom.style.display === 'block') ? 'cmpuishown' : 'tcloaded');
		},

		removeEventListener: function (_, callback) {
			delete cmp_pv.event.listeners[cmp_pv.event.listeners.indexOf(callback)];
			callback(true);
		}
	},

	/** Events **/
	event: {
		listeners: [],
		send: function (eventStatus) {
			console.info('Listeners fired : ' + eventStatus);
			cmp_pv.lastEvent = eventStatus;
			if (cmp_pv.event.listeners.length > 0) {
				cmp_pv.commands.getTCData(null, function (tcData, success) {
					tcData.eventStatus = eventStatus;
					for (var i = 0; i < cmp_pv.event.listeners.length; i++) {
						if (typeof cmp_pv.event.listeners[i] === 'function') {
							cmp_pv.event.listeners[i](tcData, success);
						}
					}
				});
			}
		}
	},

	/** UI **/
	ui: {
		dom: null,
		htmlOverflow: '',
		create: function (it) {
			// Security
			if (cmp_pv.ui.dom !== null) return cmp_pv.ui.show(true);

			if (typeof cmp_pv.globalVendorList === 'undefined') {
				cmp_pv._fetchGlobalVendorList(function () {
					if (it < 2) cmp_pv.ui.create(++it);
					else cmp_pv.ui.show(false);
				});
			} else {
				try {
					// Check CMP visibility : if any problem then hide background
					setTimeout(function () {
						var el = document.getElementById('CMP_PV');
						if (el === null || window.getComputedStyle(el).display === "none" || window.getComputedStyle(el).visibility === "hidden" || !cmp_pv.ui.isElementInViewport(el)) {
							cmp_pv.ui.show(false);
						}
					}, 2000);

					if (typeof cmp_pv.consentString.data.coreString === 'undefined') cmp_pv.consentString.data = cmp_pv.consentString.generateConsentData();
					// Update VendorList Version
					cmp_pv.consentString.data.coreString.vendorListVersion = cmp_pv.globalVendorList.vendorListVersion;
					// Create UI
					cmp_pv.ui.dom = document.createElement('div');

					var css = '';
					css += '.cmpcontainer {position: fixed; top:0; bottom: 0; left: 0; right: 0; z-index: 100000; background: rgba(33,41,52,.66);}';
					css += '#CMP_PV {background: #fff; padding: 15px;font-family:Tahoma, Geneva, sans-serif; font-size: 14px;box-shadow: 0 0 5px #000000a1;box-sizing: border-box;max-width: 1030px;margin: auto;min-width: 320px;border-radius: 2px;margin-top: 50vh;transform: translateY(-50%);}';
					css += '#CMP_PV h2{font-size: initial;}';
					css += '#CMP_PV h3{margin:16px 0;}';
					css += '#CMP_PV p{margin:0;}';
					css += '#CMP_PV ul{margin:14px 0;padding-left: 40px;}';
					css += '#CMP_PV li{list-style-type: circle;}';
					css += '#CMP_PV a{color:' + cmp_pv.conf.uiColor + '; text-decoration: underline; cursor: pointer;}';
					css += '#CMP_PV a:hover{color:#D41920; text-decoration: none;}';
					css += '#CMP_PV button{background-color: ' + cmp_pv.conf.uiColor + ';border: 2px solid ' + cmp_pv.conf.uiColor + ';font-size: 20px;font-weight: bold;color: #fff;cursor: pointer;padding:5px; transition: background 300ms;}';
					css += '#CMP_PV button:hover{background-color: #FFF;color:' + cmp_pv.conf.uiColor + ';}';
					css += '#CMP_PV button.inverse{background-color: #FFF;color:' + cmp_pv.conf.uiColor + ';}';
					css += '#CMP_PV button.inverse:hover{background-color: ' + cmp_pv.conf.uiColor + ';color:#FFF;}';
					css += '#CMP_PV .switch{position: relative;display: inline-block;width: 56px;height: 22px;cursor: pointer;color:white;vertical-align: middle;}';
					css += '#CMP_PV .switch input {display:none;}';
					css += '#CMP_PV .slider{display: block;position: relative; cursor: pointer; background-color: #ccc; -webkit-transition: .2s; transition: .2s;border-radius: 34px;height: 22px; width: 80%;}';
					css += '#CMP_PV .slider:before{position: absolute;content: "";height: 18px; width: 18px;bottom: 1px;left:1px;background-color: white;-webkit-transition: .2s;transition: .2s;border-radius: 50%;border:1px solid #aaa}';
					css += '#CMP_PV .switchLI .slider:after{position: absolute;content: "LI";height: 18px; width: 18px;bottom: 1px;left:24px;}';
					css += '#CMP_PV input:checked + .slider:after{left:8px;}';
					css += '#CMP_PV input:checked + .slider{background-color: #8BC34A;}';
					css += '#CMP_PV input:focus + .slider{box-shadow: 0 0 1px #8BC34A;}';
					css += '#CMP_PV input:checked + .slider:before {transform: translateX(22px);border-color:#7BAA44;}';
					// css += '#CMP_PV #step1{max-width:770px;}';
					css += '#CMP_PV #step1 .title{color: #111;font-weight: bold;text-align: center;font-size:28px;padding: 10px 10px 20px 10px;text-transform: uppercase;text-shadow: 0 1px 2px rgba(0, 0, 0, 0.39);}';
					css += '#CMP_PV #step1 .buttons{margin:38px 0 10px 0;}';
					css += '#CMP_PV #step1 .buttons > *{min-width: 210px; font-size: 16px;margin: 0 15px;text-align:center;}';
					css += '#CMP_PV #step1 .buttons > a{line-height: 43px;}';
					css += '#CMP_PV #step1 .desc>p{font-size: 15px;padding: 5px 15px;text-align:justify;line-height: 21px;color: #5d5d5d;}';
					css += '#CMP_PV #step1 .desc>p:nth-child(2){line-height: normal;}';
					css += '#CMP_PV #step1 .desc>p>i{display: inline; font-style: normal;color: #b5b5b5;}';
					css += '#CMP_PV .container{max-width: 1000px; margin-left:auto;margin-right:auto;/*display: flex;*/}';
					css += '#CMP_PV .container:after{content:\'\';display:block;clear:both;}';
					css += '#CMP_PV #step2 .desc{background: white;box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);padding: 10px;box-sizing: border-box;margin-top:10px;align-items: center;font-size:13px;padding-bottom: 0;}';
					css += '#CMP_PV #step2 .desc div{display: flex;}';
					css += '#CMP_PV #step2 .desc button{font-size: 16px;margin-left: 9px;white-space:nowrap;flex: 1;min-width:120px;}';
					css += '#CMP_PV #step2 .desc div p{flex: 1;}';
					css += '#CMP_PV #step2 .desc.liste>div:first-child{display:none;}';
					css += '#CMP_PV #step2 .desc:not(.liste)>div:nth-child(2){display:none;}';
					css += '#CMP_PV #step2 .desc.liste p{margin-left: 10px;font-weight: bold;font-size: 15px;}';
					css += '#CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .purposes_desc {box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);padding: 0;width: 50%;margin:0;overflow: auto;height: 330px;}';
					css += '#CMP_PV #step2 .container .purposes {width: 65%;}';
					css += '#CMP_PV #step2 .container .purposes_desc {width: 35%;}';
					css += '#CMP_PV #step2 .container .purposes li{background: #3c3c3c; color: white;position:relative; margin:0;display: block;overflow: hidden;}';
					css += '#CMP_PV #step2 .container .purposes li:last-child{border-bottom: none;}';
					css += '#CMP_PV #step2 .container .purposes li>h4:first-child{border-left: 3px solid transparent;}';
					css += '#CMP_PV #step2 .container .purposes li>h4 .arrow{padding: 0 16px 0 0;width: 28px;text-align: right;}';
					css += '#CMP_PV #step2 .container .purposes li>h4 .title{padding: 8px}';
					css += '#CMP_PV #step2 .container .purposes li>h4 .arrow:after{content:\'\\276d\'; font-size: 25px;transition: all 0.5s;display: inline-block;height: 40px;}';
					css += '#CMP_PV #step2 .container .purposes li>h4{display:table;margin:0;font-weight:normal;cursor:pointer;height: 45px;width: 100%;box-sizing: border-box;border-bottom: 1px solid rgba(51, 51, 51);}';
					css += '#CMP_PV #step2 .container .purposes li>h4:hover{background: #5f5f5f;}';
					css += '#CMP_PV #step2 .container .purposes li.titre{background: #5f5f5f;}';
					css += '#CMP_PV #step2 .container .purposes li>h4>span{display: table-cell;vertical-align: middle;}';
					css += '#CMP_PV #step2 .container .purposes li>h4>label{display: table-cell;border-top: 9px solid transparent;border-bottom: 9px solid transparent;}';
					css += '#CMP_PV #step2 .container .purposes li.active{background: #515151;}';
					css += '#CMP_PV #step2 .container .purposes li.active>h4:first-child{border-left: 3px solid ' + cmp_pv.conf.uiColor + ';}';
					css += '#CMP_PV #step2 .container .purposes li.active>h4 .arrow::after{transform: rotate(0.5turn);}';
					css += '#CMP_PV #step2 .container .purposes_desc{background: white;position: relative;}';
					css += '#CMP_PV #step2 .container .vendors li>h4>span{padding: 2px 5px;}';
					css += '#CMP_PV #step2 .container .vendors li .switch{border-top: 4px solid transparent;border-bottom: 4px solid transparent;}';
					// css += '#CMP_PV #step2 .container .vendors li .slider{height: 8px;}';
					// css += '#CMP_PV #step2 .container .vendors li .slider:before{height: 18px; width: 18px;bottom: 1px;left:1px;}';
					css += '#CMP_PV #step2 .container .vendors li>h4{height: 30px;}';
					css += '#CMP_PV #step2 .container .vendors li>h4 .arrow::after{height: 20px;font-size:16px;}';
					css += '#CMP_PV #step2 .container .purposes_desc>div{position: absolute;top: 30px;left: 0;right: 0;bottom: 0;overflow: auto;margin: 0;}';
					for (var i = 1; i < 11; i++) {
						css += '#CMP_PV #step2 .container .vendors.pid' + i + ' li:not(.pid' + i + '){display: none;}';
						css += '#CMP_PV #step2 .container .vendors.pidlit' + i + ' li:not(.pidlit' + i + '){display: none;}';
					}
					css += '#CMP_PV #step2 .container .vendors.pids1 li:not(.pids1){display: none;}#CMP_PV #step2 .container .vendors.pids2 li:not(.pids2){display: none;}';
					css += '#CMP_PV #step2 .container .vendors.pidf1 li:not(.pidf1){display: none;}#CMP_PV #step2 .container .vendors.pidf2 li:not(.pidf2){display: none;}#CMP_PV #step2 .container .vendors.pidf3 li:not(.pidf3){display: none;}';
					css += '#CMP_PV #step2 .container .vendors.pidlit li.pidlit{display: none;}';
					css += '#CMP_PV .buttons{display:flex;margin-top:10px;}';
					css += '#CMP_PV .buttons>*{flex:1;}';
					css += '#CMP_PV .buttons>a{line-height: 27px;}';
					css += '#CMP_PV .buttons>a:nth-child(2){text-align:center;}';
					css += '#CMP_PV #step2 .buttons button{font-size: 16px;padding: 5px 15px;}';
					css += '#CMP_PV #step2 .purposes_desc>h4{display:block;margin:0;padding:5px 0;text-align: center;text-decoration:none;background:#515151;color:#ededed;border-bottom: 3px solid ' + cmp_pv.conf.uiColor + ';}';
					css += '#CMP_PV #step2 .purposes_desc p{padding:10px;white-space: pre-wrap;}';
					css += '#CMP_PV #step2 .table-header{justify-content: flex-end; width: 64.5%;padding: 3px 0;}';
					css += '#CMP_PV #step2 .table-header span{font-size: 20px;line-height: 18px;}';
					css += '#CMP_PV #step2 .table-header br{display: none;}';
					css += '#CMP_PV #step2 .table-header span:nth-child(3){transform: scaleX(-1);margin-left: 43px;}';
					//Responsive
					css += '@media screen and (min-width: 1024px) {';
					css += '	#CMP_PV #step2 .container{width:1000px;}';
					css += '}';
					css += '@media screen and (max-width: 640px) {';
					css += '	#CMP_PV{padding:0;width:100%;}';
					css += '	#CMP_PV button{min-height: 46px;}';
					css += '	#CMP_PV #step1{text-align: center;}';
					css += '	#CMP_PV #step1 .desc{display:block;padding: 0 10px 10px 10px;height: calc(100vh - 172px);max-height: 516px;overflow-y: auto;}';
					css += '    #CMP_PV .buttons{flex-direction: column;margin-bottom: 10px;}';
					css += '    #CMP_PV #step1 .buttons{margin:0;border-top:1px solid #bbbbbb;}';
					css += '    #CMP_PV #step1 .title{padding: 15px 20px; font-size: 18px;}';
					css += '	#CMP_PV #step2 .desc>div:first-child{flex-flow: column;justify-content: space-evenly;}';
					css += '	#CMP_PV #step2 .desc{align-items: initial;margin-top: 0;}';
					css += '	#CMP_PV #step2 .buttons{margin: 10px;flex-wrap: wrap;flex-direction: row;}';
					css += '	#CMP_PV #step2 #purposes, #CMP_PV #step2 #vendors{width:200%;max-width:initial;transition: transform .2s ease-in-out;}';
					css += '	#CMP_PV #step2 .container .purposes{width:50%;}';
					css += '	#CMP_PV #step2 .container .purposes_desc{width:46%;}';
					css += '	#CMP_PV #step2 .container .purposes li{width:auto;}';
					css += '	#CMP_PV #step2 .container .purposes li.active > h4 .arrow::after{transform: none;animation: bounce 0.6s ease-out;}';
					css += '	#CMP_PV #step2 > .container.showPurposes .purposes li > h4 .arrow::after{visibility: hidden;}';
					css += '	#CMP_PV #step2 > .container.showPurposes .purposes li.active > h4 .arrow::after{visibility: visible;transform: rotate(0.5turn);}';
					css += '	#CMP_PV #step2 > .container.showPurposes {transform: translate3d(-46%, 0, 0);}';
					css += '	#CMP_PV #step2 .desc>div>div{margin-top: 10px;}';
					css += '	#CMP_PV #step2 .container .purposes li > h4 .title{padding: 8px;}';
					css += '    #CMP_PV .buttons>a{flex:1 50%;line-height: 42px;}';
					css += '    #CMP_PV #step1 .buttons > *, #CMP_PV #step2 .buttons{margin: 0;}';
					css += '    #CMP_PV .buttons>a:first-child{padding-left: 15px;box-sizing: border-box;}';
					css += '    #CMP_PV .buttons>a:nth-child(2){padding-right: 15px;text-align:right;box-sizing: border-box;}';
					css += '    #CMP_PV #step2 .table-header{width: 95%;}';
					css += '    #CMP_PV #step2 .table-header br{display: block;}';
					css += '	@keyframes bounce{';
					css += '		0% {transform:translate3d(0,0,0);}';
					css += '		30% {transform:translate3d(5px,0,0);}';
					css += '		60% {transform:translate3d(0px,0,0);}';
					css += '		80% {transform:translate3d(2px,0,0);}';
					css += '		100% {transform:translate3d(0,0,0);}';
					css += '	}';
					css += '}';
					css += '@media screen and (max-height: 670px) {';
					css += '    #CMP_PV #step2 .container .vendors, #CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .purposes_desc {height: 272px;}';
					css += '	#CMP_PV #step1 .desc{max-height: 356px;}';
					css += '}';
					css += '@media screen and (max-height: 550px) {';
					css += '	#CMP_PV #step1 .desc{max-height: 256px;}';
					css += '    #CMP_PV #step2 .container .vendors, #CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .purposes_desc {height: 172px;}';
					css += '}';
					// Hack IE
					var ie = this.detectIE();
					if (ie > 0) {
						if (ie <= 10) {
							css += '#CMP_PV #step2 .desc div {width:100%; display: block;}';
							css += '#CMP_PV #step1 .container.buttons > *{width:50%; display: block;}';
							css += '#CMP_PV #step2 .container.buttons > *{width:33%; display: block;}';
						}
					}
					// BottomBar fix
					if (this.detectIOS()) {
						css += '#CMP_PV{margin-top: calc(50vh - 44px);}';
						css += '@media screen and (max-height: 670px) {';
						css += '	#CMP_PV{margin-top: calc(50vh - 34px);}';
						css += '}';
						css += '@media screen and (max-height: 550px) {';
						css += '	#CMP_PV{margin-top: calc(50vh - 34px);}';
						css += '}';
					}
					var html = '<div id="CMP_PV">';
					html += '<div id="step1">';
					html += '	<div class="title">Vos choix en matière de cookies</div>';
					html += '	<div class="desc">';
					html += '		<p>Nos partenaires et nous-mêmes utilisons différentes technologies, telles que les cookies, qui nous permettent d\'accéder a votre historique de navigation, votre IP, etc., pour personnaliser les contenus et les publicités, proposer des fonctionnalités sur les réseaux sociaux et analyser le trafic. Merci de cliquer sur le bouton ci-dessous pour donner votre accord. Vous pouvez changer d\'avis et modifier vos choix à tout moment. Le fait de ne pas consentir ne vous empêchera pas d\'accèder à notre service. <a onclick="cmp_pv.ui.showPurposes();">Afficher les utilisations prévues et les accepter ou les refuser</a>.</p>';
					html += '		<p>Exemples d\'usages : ';
					for (var key in cmp_pv.conf.firstScreenPurposes) {
						for (i in cmp_pv.conf.firstScreenPurposes[key]) {
							if (cmp_pv.ui.language['fr'].hasOwnProperty(key)) {
								var purpose = cmp_pv.ui.language['fr'][key][cmp_pv.conf.firstScreenPurposes[key][i]];
								html += '<i>' + purpose.name + '. </i>';
							}
						}
					}
					html += '		</p>';
					html += '		<p>Certains de nos partenaires ne demandent pas votre consentement pour traiter vos données, et se basent à la place sur leur intérêt légitime pour le faire. Vous pouvez consulter la liste de ces partenaires, les usages pour lesquels ils traitent vos données et vous y opposer en <a onclick="cmp_pv.ui.showVendorsPurpose(\'LIT\', \'\')">cliquant ici</a>. <br/> Vos choix ne s\'appliqueront sur que les sites du groupe Paruvendu.fr.</p>';
					html += '	</div>';
					html += '	<div class="container buttons">';
					html += '		<a onclick="cmp_pv.ui.showVendors()">Voir nos partenaires</a>';
					// html += '		<button class="inverse" onclick="cmp_pv.ui.showPurposes();">Je personnalise ou Je refuse</button>';
					html += '		<button onclick="cmp_pv.cookie.saveConsent(true);">J\'accepte</button>';
					html += '	</div>';
					html += '</div>';
					html += '<div id="step2" style="display: none;">';
					html += '	<div class="container desc">';
					html += '		<div>';
					html += '			<p>La collecte des données personnelles se fait en fonction des objectifs listés ci dessous. Choisissez comment vos données personnelles sont utilisées pour chaque finalité et pour chaque partenaire publicitaire. <a href="' + cmp_pv.conf.urlCookiesUsage + '" target="_blank">En savoir plus sur la gestion des cookies.</a></p>';
					html += '			<div>';
					html += '				<button onclick="cmp_pv.ui.switchAllPurposes(false);" class="inverse">Tout refuser</button>';
					html += '				<button onclick="cmp_pv.ui.switchAllPurposes(true);">Tout accepter</button>';
					html += '			</div>';
					html += '		</div>';
					html += '		<div><a href="javascript:cmp_pv.ui.showVendorsPurpose();">&lsaquo; Retour</a><p></p><label class="switch"><input type="checkbox"><span class="slider"></span></label></div>';
					html += '		<div class="table-header">Intérêts <br/>Légitimes <span>&#8628;</span><span>&#8628;</span> Consen<br/>tement</div>';
					html += '	</div>';
					html += '	<div class="container" id="purposes">';
					html += '		<ul class="purposes">';
					for (i in cmp_pv.globalVendorList.purposes) {
						purpose = cmp_pv.ui.language['fr'].purposes[i];
						html += '		<li id="purpose_' + purpose.id + '"><h4>';
						html += '			<span class="title" onclick="cmp_pv.ui.showPurposeDescription(\'purposes\', ' + purpose.id + ');">' + purpose.name + '</span>';
						if (i > 1) {
							html += '			<label class="switch switchLI"><input type="checkbox" onchange="cmp_pv.ui.switchPurpose(\'purposesLITransparency\',' + purpose.id + ', this.checked);"' + ((cmp_pv.consentString.data.coreString.purposesLITransparency[purpose.id]) ? 'checked' : '') + '><span class="slider"></span></label>';
						}
						html += '			<label class="switch"><input type="checkbox" onchange="cmp_pv.ui.switchPurpose(\'purposesConsent\',' + purpose.id + ', this.checked);"' + ((cmp_pv.consentString.data.coreString.purposesConsent[purpose.id]) ? 'checked' : '') + '><span class="slider"></span></label>';
						html += '			<span class="arrow" onclick="cmp_pv.ui.showPurposeDescription(\'purposes\', ' + purpose.id + ', true);"></span>';
						html += '		</h4></li>';
					}
					html += '			<li class="titre"></li>';
					for (i in cmp_pv.globalVendorList.specialFeatures) {
						purpose = cmp_pv.ui.language['fr'].specialFeatures[i];
						html += '		<li id="purpose_s' + purpose.id + '"><h4>';
						html += '			<span class="title" onclick="cmp_pv.ui.showPurposeDescription(\'specialFeatures\', ' + purpose.id + ');">' + purpose.name + '</span>';
						html += '			<label class="switch"><input type="checkbox" onchange="cmp_pv.ui.switchPurpose(\'specialFeatureOptIns\',' + purpose.id + ', this.checked);"' + ((cmp_pv.consentString.data.coreString.specialFeatureOptIns[purpose.id]) ? 'checked' : '') + '><span class="slider"></span></label>';
						html += '			<span class="arrow" onclick="cmp_pv.ui.showPurposeDescription(\'specialFeatures\', ' + purpose.id + ', true);"></span>';
						html += '		</h4></li>';
					}
					html += '			<li class="titre"></li>';
					for (i in cmp_pv.globalVendorList.features) {
						purpose = cmp_pv.ui.language['fr'].features[i];
						html += '		<li id="purpose_f' + purpose.id + '"><h4>';
						html += '			<span class="title" onclick="cmp_pv.ui.showPurposeDescription(\'features\', ' + purpose.id + ');">' + purpose.name + '</span>';
						html += '			<span class="arrow" onclick="cmp_pv.ui.showPurposeDescription(\'features\', ' + purpose.id + ', true);"></span>';
						html += '		</h4></li>';
					}
					html += '		</ul>';
					html += '		<div class="purposes_desc">';
					html += '			<h4>Description</h4>';
					html += '			<div><p id="purpose_desc"></p></div>';
					html += '		</div>';
					html += '	</div>';
					html += '	<div class="container" id="vendors" style="display: none;">';
					html += '		<div class="purposes vendors">';
					html += '		</div>';
					html += '		<div class="purposes_desc">';
					html += '			<h4>Description</h4>';
					html += '			<div><p id="vendor_desc"></p></div>';
					html += '		</div>';
					html += '	</div>';
					html += '	<div class="container buttons">';
					html += '		<a href="javascript:cmp_pv.ui.showStep(1);">&lsaquo; Retour</a>';
					html += '	    <a onclick="cmp_pv.ui.showVendorsPurpose()" id="link_vendors">Voir nos partenaires</a>';
					html += '		<button onclick="cmp_pv.cookie.saveConsent();">Enregistrer</button>';
					html += '	</div>';
					html += '</div>';
					html += '</div>';

					cmp_pv.ui.dom.style.display = 'block';
					cmp_pv.ui.dom.innerHTML = html;
					document.body.appendChild(cmp_pv.ui.dom);

					var sheet = document.createElement('style');
					sheet.innerHTML = css;
					document.head.appendChild(sheet);

					cmp_pv.ui.dom.className = "cmpcontainer";

					// VirtualScroll
					var list = this.virtualList.init();
					document.getElementById("vendors").children[0].appendChild(list);

					// Select first
					cmp_pv.ui.showPurposeDescription('purposes', 1);
					cmp_pv.ui.showVendorDescription(cmp_pv.globalVendorList.vendorsOrder[0], 0);

					// Fire cmpuishown event
					cmp_pv.event.send('cmpuishown');

					// Accept on scroll
					//window.addEventListener('scroll', cmp_pv.ui.acceptOnEvent, {passive: true, once: true});
				} catch (e) {
					console.error(e);
					cmp_pv.ui.show(false);
				}
			}
		},
		observer: new MutationObserver(function (mutations) {
			mutations.forEach(function () {
				if (document.documentElement.style.overflow === 'hidden') return;
				cmp_pv.ui.htmlOverflow = document.documentElement.style.overflow;
				document.documentElement.style.overflow = 'hidden';
			});
		}),
		show: function (bool) {
			if (cmp_pv.ui.dom === null) {
				if (bool) cmp_pv.ui.create(0);
			} else {
				cmp_pv.ui.dom.style.display = (!bool) ? 'none' : 'block';

				// Fire cmpuishown event
				if (bool) {
					cmp_pv.event.send('cmpuishown');
					delete cmp_pv.consentString.data.tcString;
				}
			}
			if (bool) {
				this.htmlOverflow = document.documentElement.style.overflow;
				this.observer.observe(document.documentElement, {attributes: true, attributeFilter: ['style']});
			} else {
				this.observer.disconnect();
			}
			document.documentElement.style.overflow = (!bool) ? this.htmlOverflow : 'hidden';
			return true;
		},
		showPurposes: function () {
			this.showStep(2);
			document.getElementById('vendors').style.display = 'none';
			document.getElementById('link_vendors').innerText = 'Voir nos partenaires';
			document.getElementById('purposes').style.display = 'flex';
		},
		showVendors: function () {
			this.showStep(2);
			document.getElementById('vendors').style.display = 'flex';
			document.getElementById('link_vendors').innerText = 'Voir les utilisations';
			document.getElementById('purposes').style.display = 'none';
		},
		showStep: function (step) {
			for (var i = 1; i < 3; i++) {
				document.getElementById('step' + i).style.display = (i === step) ? 'block' : 'none';
			}
		},
		showVendorsPurpose: function (field, purpose) {
			this.showStep(2);
			var el = document.getElementById('purposes');
			var el2 = document.getElementById('vendors');
			var step = document.getElementById('step2');
			el2.style.display = (el.style.display === 'none') ? 'none' : 'flex';
			if (typeof purpose != 'undefined') {
				var f = field;
				var s = '';
				if (field === 'specialFeatures') {
					s = 's';
				} else if (field === 'LIT') {
					f = "purposes";
					s = 'lit';
				} else if (field === 'features') {
					s = 'f';
				}
				el2.children[0].className = 'purposes vendors pid' + s + purpose;
				el2.children[0].scrollTop = 0;
				step.children[0].className += ' liste';
				step.children[0].children[1].children[1].innerText = (purpose === '' && field === 'LIT') ? 'Partenaires utilisant les traitements de données basés sur l\'intérêt légitime' : ((field === 'LIT') ? 'Intérêt légitime : ' : '') + cmp_pv.ui.language['fr'][f][purpose].name;
				step.children[3].style.display = 'none';
				step.children[0].children[1].children[2].style.display = (field === 'features') ? 'none' : 'inline-block';
				step.children[0].children[1].children[2].className = (s === 'lit') ? 'switch switchLI' : 'switch';
				step.children[0].children[1].children[2].children[0].onchange = function () {
					cmp_pv.ui.switchPurposeUI(field, this.checked, purpose);
				};
				step.children[0].children[1].children[2].children[0].checked = (purpose === '') ? true : document.querySelector('#purpose_' + purpose + ' .switch' + ((s === 'lit') ? '.switchLI' : ':not(.switchLI)') + ' input').checked;
				document.querySelector('#vendors ul li.pid' + s + purpose + ' span').onclick();
			} else {
				el2.children[0].className = 'purposes vendors';
				step.children[0].className = step.children[0].className.replace(' liste', '');
				step.children[3].style.display = '';
			}
			document.getElementById('link_vendors').innerText = (el.style.display === 'none') ? 'Voir nos partenaires' : 'Voir les utilisations';
			el.style.display = (el.style.display === 'none') ? 'flex' : 'none';
		},
		showPurposeDescription: function (field, purpose, arrow) {
			var active = document.querySelector('.purposes li.active');
			if (active != null) active.className = '';
			var id = '';
			if (field === 'specialFeatures') id = 's';
			else if (field === 'features') id = 'f';
			document.getElementById('purpose_' + id + purpose).className = 'active';
			document.getElementById('purpose_desc').innerHTML = "<p>" + cmp_pv.ui.language['fr'][field][purpose].description + "</p><p>" + cmp_pv.ui.language['fr'][field][purpose].descriptionLegal.replace(/Les partenaires peuvent :/i, 'Nos partenaires et nous-mêmes pouvons :') + "</p><a onclick='cmp_pv.ui.showVendorsPurpose(\"" + field + "\", " + purpose + ")'>Voir la liste</a>" + ((purpose > 1 && field === "purposes") ? "<br/><a onclick='cmp_pv.ui.showVendorsPurpose(\"LIT\", " + purpose + ")'>Voir la liste intérêt légitime</a>" : "");
			if (arrow === true) {
				this.arrow('purposes');
			}
		},
		showVendorDescription: function (id, i, f, arrow) {
			var active = document.querySelector('.vendors li.active');
			if (active != null) active.className = active.className.replace(' active', '');
			document.querySelector('.vendors li:nth-of-type(' + (i + 1) + ')').className += ' active';
			var vendor;
			if (f === 'specific') {
				vendor = cmp_pv.pubvendor[id];
			} else {
				vendor = cmp_pv.globalVendorList.vendors[id];
			}
			if (typeof vendor == 'undefined') return;
			var html = '<h2>' + vendor.name + '</h2><a href="' + vendor.policyUrl + '" target="_blank">Politique de confidentialité</a><br/>';
			var y = 0;
			var fields = ['purposes', 'legIntPurposes', 'specialPurposes', 'features', 'specialFeatures'];
			for (i in fields) {
				var field = fields[i];
				if (!vendor.hasOwnProperty(field)) continue;
				if (vendor[field].length > 0) {
					var lang;
					if (field === 'purposes') {
						html += '<h3>Traitements de données basés sur le consentement :</h3>';
						lang = 'purposes';
					} else if (field === 'legIntPurposes') {
						html += '<h3>Traitement de données basés sur l\'intérêt légitime :</h3>';
						lang = 'purposes';
					} else if (field === 'specialPurposes') {
						html += '<h3>Traitements de données spéciaux :</h3>';
						lang = 'specialPurposes';
					} else if (field === 'features') {
						html += '<h3>Traitements de données supplémentaires :</h3>';
						lang = 'features';
					} else if (field === 'specialFeatures') {
						html += '<h3>Traitements de données supplémentaires :</h3>';
						lang = 'specialFeatures';
					}
					html += '<ul>';
					for (y = 0; y < vendor[field].length; y++) {
						html += '<li>' + cmp_pv.ui.language['fr'][lang][vendor[field][y]].name + '</li>';
					}
					html += '</ul>';
				}
			}
			var el = document.getElementById('vendor_desc');
			el.innerHTML = html;
			el.parentNode.scrollTop = 0;
			if (arrow === true) {
				this.arrow('vendors');
			}
			this.virtualList.active = id;
		},
		showGoogleVendorDescription: function (id, i, arrow) {
			var active = document.querySelector('.vendors li.active');
			if (active != null) active.className = active.className.replace(' active', '');
			document.querySelector('.vendors li:nth-of-type(' + (i + 1) + ')').className += ' active';
			var vendor = cmp_pv.googleACList[id];
			if (typeof vendor == 'undefined') return;
			var html = '<div>Partenaire Google</div><h2>' + vendor[1] + '</h2><a href="' + vendor[2] + '" target="_blank">Politique de confidentialité</a><br/>';
			var el = document.getElementById('vendor_desc');
			el.innerHTML = html;
			el.parentNode.scrollTop = 0;
			if (arrow === true) {
				this.arrow('vendors');
			}
			this.virtualList.active = 'G' + id;
		},
		switchPurpose: function (field, purpose, checked) {
			cmp_pv.consentString.data.coreString[field][purpose] = checked;
			cmp_pv.consentString.data.publisherTC['pub' + field[0].toUpperCase() + field.slice(1)][purpose] = checked;
			var lit = field === 'purposesLITransparency';
			var matches = document.querySelectorAll("#vendors .pid" + (lit ? 'lit' : '') + purpose + " .switch" + (lit ? '.switchLI' : ':not(.switchLI)') + " input");
			var vendorField = lit ? 'vendorLegitimateInterest' : 'vendorConsent';
			for (var i = 0; i < matches.length; i++) {
				cmp_pv.consentString.data.coreString[vendorField].bitField[matches[i].value] = checked;
				matches[i].checked = checked;
			}
		},
		switchAllPurposes: function (checked) {
			cmp_pv.cookie.saveConsent(checked);
		},
		switchVendor: function (field, vendor, f, checked) {
			cmp_pv.consentString.data[f][field].bitField[vendor] = checked;
			if (f === 'specific' && cmp_pv.pubvendor[vendor].dep > 0) {
				cmp_pv.consentString.data.coreString.vendorConsent.bitField[vendor] = checked;
				var match = document.querySelector("#vendors input[value='" + cmp_pv.pubvendor[vendor].dep + "']");
				if (match != null) {
					match.checked = checked;
				}
			}
		},
		switchGoogleVendor: function (vendor, checked) {
			cmp_pv.consentString.data.googleAC[vendor] = checked;
		},
		switchPurposeUI: function (field, checked, purpose) {
			var s = '';
			var v = '';
			var lit = field === 'LIT';
			var vendorField = lit ? 'vendorLegitimateInterest' : 'vendorConsent';

			if (typeof purpose !== 'undefined') {
				v = '.pid';
				s = '#purpose_';
				if (field === 'specialFeatures') {
					v += 's';
					s += 's';
				} else if (lit) {
					v += 'lit';
				}
				v += purpose;
				s += purpose;
			}
			var matches = document.querySelectorAll("#vendors " + v + " .switch" + (lit ? '.switchLI' : ':not(.switchLI)') + " input");
			for (var i = 0; i < matches.length; i++) {
				cmp_pv.consentString.data.coreString[vendorField].bitField[matches[i].value] = checked;
				matches[i].checked = checked;
			}
			matches = document.querySelectorAll("#purposes " + s + " .switch" + (lit ? '.switchLI' : ':not(.switchLI)') + " input");
			for (i = 0; i < matches.length; i++) {
				matches[i].checked = checked;
			}
		},
		detectIE: function () {
			var ua = window.navigator.userAgent;
			var msie = ua.indexOf('MSIE ');
			if (msie > 0) {
				return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
			}
			var trident = ua.indexOf('Trident/');
			if (trident > 0) {
				return 11;
			}
			return 0;
		},
		detectIOS: function () {
			return /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
		},
		sortVendors: function () {
			cmp_pv.globalVendorList.vendorsOrder = Object.keys(cmp_pv.globalVendorList.vendors).sort(function (a, b) {
				if (cmp_pv.globalVendorList.vendors[a].name.toLowerCase() < cmp_pv.globalVendorList.vendors[b].name.toLowerCase()) {
					return -1;
				} else {
					return 1;
				}
			});
		},
		arrow: function (id) {
			var container = document.getElementById(id);
			if (container.className.indexOf('showPurposes') === -1) {
				container.className = 'container showPurposes';
			} else {
				container.className = 'container';
			}
		},
		isElementInViewport: function (el) {
			var rect = el.getBoundingClientRect();

			return (
				rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
				rect.left >= 0 &&
				rect.bottom >= 0 &&
				rect.right <= (window.innerWidth || document.documentElement.clientWidth)
			);
		},
		virtualList: {
			itemHeight: 31,
			container: null,
			lastRepaintY: null,
			screenItemsLen: null,
			cachedItemsLen: null,
			maxBuffer: null,
			totalRows: 0,
			active: null,

			init: function () {
				this.totalRows = cmp_pv.globalVendorList.vendorsOrder.length + cmp_pv.pubvendorOrder.length;
				if (cmp_pv.conf.googleAC) this.totalRows += cmp_pv.googleACList.length;
				var container = this.createContainer(this.totalRows * this.itemHeight);
				this.screenItemsLen = 15;
				this.cachedItemsLen = this.screenItemsLen * 3;
				this.maxBuffer = this.screenItemsLen * this.itemHeight;
				this.renderChunk(0, this.cachedItemsLen);
				return container;
			},

			createContainer: function (h) {
				var c = document.createElement("div");
				c.style.height = '100%';
				c.style.overflow = "auto";
				c.addEventListener("scroll", function (e) {
					if (cmp_pv.ui.virtualList.animation) cancelAnimationFrame(cmp_pv.ui.virtualList.animation);
					cmp_pv.ui.virtualList.animation = window.requestAnimationFrame(function () {
						cmp_pv.ui.virtualList.onScroll(e);
					})
				});
				var v = document.createElement("div");
				v.style.overflow = "hidden";
				v.style.height = h + "px";
				v.style.position = "relative";
				var t = document.createElement("div");
				t.style.willChange = "transform";
				v.appendChild(t);
				c.appendChild(v);
				this.container = t;
				return c;
			},

			renderChunk: function (fromPos, howMany) {
				var fragment = document.createDocumentFragment();
				var finalItem = fromPos + howMany;
				if (finalItem > this.totalRows) finalItem = this.totalRows;
				var vendor, html, item, item2, y, y2, field;
				var i2 = 0;

				for (var i = fromPos; i < finalItem; i++) {
					item = document.createElement("li");
					y = i - cmp_pv.globalVendorList.vendorsOrder.length;
					y2 = y - cmp_pv.pubvendorOrder.length;
					if (y2 >= 0) {
						y = y2;
						if (y === 0) {
							item2 = document.createElement("li");
							html = '<h4><span>Partenaires Google</span></h4>';
							item2.className = 'titre';
							item2.innerHTML = html;
							fragment.appendChild(item2);
							i2 += 1;
						}
						vendor = cmp_pv.googleACList[y];
						html = '<h4>';
						html += '	<span onclick="cmp_pv.ui.showGoogleVendorDescription(' + y + ',' + (i - fromPos + i2) + ');">' + vendor[1] + '</span>';
						html += '	<label class="switch"><input type="checkbox" value="" ' + ((cmp_pv.consentString.data.googleAC[vendor[0]]) ? 'checked' : '') + ' onchange="cmp_pv.ui.switchGoogleVendor(' + vendor[0] + ', this.checked);"><span class="slider"></span></label>';
						html += '	<span class="arrow" onclick="cmp_pv.ui.showGoogleVendorDescription(' + y + ',' + (i - fromPos + i2) + ', true);"></span>';
						html += '</h4>';
						item.className = (this.active === 'G' + y) ? ' active' : '';
					} else {
						if (y === 0) {
							item2 = document.createElement("li");
							html = '<h4><span>Partenaires ParuVendu.fr</span></h4>';
							item2.className = 'titre';
							item2.innerHTML = html;
							fragment.appendChild(item2);
							i2 += 1;
						}
						if (y >= 0) {
							vendor = cmp_pv.pubvendor[cmp_pv.pubvendorOrder[y]];
							field = 'specific';
						} else {
							vendor = cmp_pv.globalVendorList.vendors[cmp_pv.globalVendorList.vendorsOrder[i]];
							field = 'coreString';
						}
						html = '<h4>';
						html += '	<span onclick="cmp_pv.ui.showVendorDescription(' + vendor.id + ',' + (i - fromPos + i2) + ', \'' + field + '\');">' + vendor.name + '</span>';
						if (vendor.legIntPurposes.length > 0) html += '<label class="switch switchLI"><input type="checkbox" value="' + vendor.id + '" ' + ((cmp_pv.consentString.data[field].vendorLegitimateInterest.bitField[vendor.id]) ? 'checked' : '') + ' onchange="cmp_pv.ui.switchVendor(\'vendorLegitimateInterest\', ' + vendor.id + ', \'' + field + '\', this.checked);"><span class="slider"></span></label>';
						html += '	<label class="switch"><input type="checkbox" value="' + vendor.id + '" ' + ((cmp_pv.consentString.data[field].vendorConsent.bitField[vendor.id]) ? 'checked' : '') + ' onchange="cmp_pv.ui.switchVendor(\'vendorConsent\', ' + vendor.id + ', \'' + field + '\', this.checked);"><span class="slider"></span></label>';
						html += '	<span class="arrow" onclick="cmp_pv.ui.showVendorDescription(' + vendor.id + ',' + (i - fromPos + i2) + ', \'' + field + '\', true);"></span>';
						html += '</h4>';
						item.className = 'pid' + vendor.purposes.join(' pid') + ' pidlit' + vendor.legIntPurposes.join(' pidlit') + ' pids' + vendor.specialFeatures.join(' pids') + ' pidf' + vendor.features.join(' pidf') + ((this.active === vendor.id) ? ' active' : '');
					}
					item.innerHTML = html;
					fragment.appendChild(item);
				}
				this.container.innerHTML = "";
				this.container.style.transform = 'translateY(' + (fromPos * this.itemHeight) + 'px)';
				this.container.appendChild(fragment);
			},

			onScroll: function (e) {
				var scrollTop = e.target.scrollTop;
				var first = parseInt(scrollTop / this.itemHeight) - this.screenItemsLen;
				first = first < 0 ? 0 : first;
				if (!this.lastRepaintY || Math.abs(scrollTop - this.lastRepaintY) > this.maxBuffer) {
					this.renderChunk(first, this.cachedItemsLen);
					this.lastRepaintY = scrollTop;
				}

				e.preventDefault && e.preventDefault();
			}
		},
		/*acceptOnEvent: function () {
			window.removeEventListener('scroll', cmp_pv.ui.acceptOnEvent, {passive: true, once: true});
			cmp_pv.cookie.saveConsent(true);
		},*/
		// https://vendorlist.consensu.org/v2/purposes-fr.json
		language: {
			'fr': {
				"purposes": {
					"1": {
						"id": 1,
						"name": "Stocker et/ou accéder à des informations stockées sur un terminal",
						"description": "Les cookies, identifiants de votre terminal ou autres informations peuvent être stockés ou consultés sur votre terminal pour les finalités qui vous sont présentées.",
						"descriptionLegal": "Les partenaires peuvent :\n* Stocker des informations et accéder à des informations stockées sur le terminal, comme les cookies et les identifiants du terminal présentés à un utilisateur.\n"
					},
					"2": {
						"id": 2,
						"name": "Sélectionner des publicités standard",
						"description": "Les publicités peuvent vous être présentées en fonction du contenu éditorial que vous consultez, de l'application que vous utilisez, de votre localisation approximative, ou de votre type de terminal\n",
						"descriptionLegal": "Pour sélectionner des publicités standard, les partenaires peuvent :\n* Utiliser des informations en temps réel sur le contexte dans lequel la publicité sera affichée, pour afficher la publicité, y compris des informations sur le contenu et le terminal, telles que : type de terminal et capacités, user agent, URL, adresse IP \n* Utiliser des données de géolocalisation non-précises d'un utilisateur\n* Contr\u00f4ler la fréquence de diffusion des publicités à un utilisateur.\n* Définir l'ordre dans lequel les publicités sont présentées à un utilisateur.\n* Empêcher une publicité de s'afficher dans un contexte éditorial inadapté (dangereux pour la marque)\nLes partenaires ne peuvent pas :\n* Créer un profil publicitaire personnalisé à l'aide de ces informations pour la sélection de publicités futures sans base légale distincte. \nN.B. \u00ab Non-précises \u00bb signifie qu'une géolocalisation approximative dans un rayon d'au moins 500 mètres est autorisée.\n"
					},
					"3": {
						"id": 3,
						"name": "Créer un profil personnalisé de publicités",
						"description": "Un profil peut être créé sur vous et sur vos centres d'intérêt pour vous présenter des publicités personnalisées susceptibles de vous intéresser.",
						"descriptionLegal": "Pour créer un profil de publicités personnalisées, les partenaires peuvent :\n* Collecter des informations sur un utilisateur, notamment son activité, ses centres d'intérêt, les sites ou applications consultés, les données démographiques ou la géolocalisation d'un utilisateur, pour créer ou modifier un profil utilisateur à utiliser dans des publicités personnalisées.\n"
					},
					"4": {
						"id": 4,
						"name": "Sélectionner des publicités personnalisées",
						"description": "Des publicités personnalisées peuvent vous être présentées sur la base d'un profil créé sur vous.",
						"descriptionLegal": "Pour sélectionner des publicités personnalisées, les partenaires peuvent :\n* Sélectionner des publicités personnalisées sur la base d'un profil utilisateur ou d'autres données d'utilisateur historiques, y compris l'activité passée d'un utilisateur, ses centres d'intérêt, les sites qu'il a visités ou les applications qu'il a utilisées, sa localisation ou ses données démographiques.\n"
					},
					"5": {
						"id": 5,
						"name": "Créer un profil pour afficher un contenu personnalisé",
						"description": "Un profil peut être créé sur vous et sur vos centres d'intérêt afin de vous présenter du contenu personnalisé susceptible de vous intéresser.",
						"descriptionLegal": "Pour créer un profil pour afficher du contenu personnalisé, les partenaires peuvent :\n* Collecter des informations sur un utilisateur, y compris l'activité d'un utilisateur, ses centres d'intérêt, les sites qu'il a visités ou les applications qu'il a utilisées, ses données démographiques ou sa localisation, pour créer ou modifier un profil utilisateur pour afficher du contenu personnalisé.\n"
					},
					"6": {
						"id": 6,
						"name": "Sélectionner du contenu personnalisé",
						"description": "Du contenu personnalisé peut vous être présenté sur la base de votre profil utilisateur.     ",
						"descriptionLegal": "Pour sélectionner du contenu personnalisé, les partenaires peuvent :\n* Sélectionner du contenu personnalisé sur la base d'un profil utilisateur induit des données relatives à son activité en ligne, ses centres d'intérêt, les sites qu'il a visités, les applications qu'il a utilisées, sa localisation ou ses données socio-démographiques.\n"
					},
					"7": {
						"id": 7,
						"name": "Mesurer la performance des publicités",
						"description": "La performance et l'efficacité des publicités que vous voyez ou avec lesquelles vous interagissez peuvent être mesurées.",
						"descriptionLegal": "Pour mesurer la performance des publicités, les partenaires peuvent:\n* Mesurer si et comment des publicités ont été présentée  à un utilisateur et comment celui-ci a interagi avec celles-ci\n* Générer des rapports sur les publicités, notamment  sur leur performance\n* Générer des rapports sur les utilisateurs ayant interagi avec des publicités en utilisant des données issues de cette interaction     \n* Fournir des rapports aux éditeurs sur les publicités présentées/affichées sur leurs propriétés numériques     \n* \u00c9valuer si une publicité diffusée dans un contexte éditorial approprié (conforme à l'image de la marque) sans danger pour la marque)\n* Déterminer le pourcentage du visionnage éventuel de la publicité et sa durée      \n* Combiner ces informations avec d'autres informations collectées au préalable, pouvant provenir de sites internet et applications\nLes partenaires ne peuvent pas:     \n* Croiser des données d'audience, issues ou dérivées d'un panel, avec des données de mesure de performance, sans base légale pour  titre \"Finalité 9\". \n"
					},
					"8": {
						"id": 8,
						"name": "Mesurer la performance du contenu",
						"description": "La performance et l'efficacité du contenu que vous voyez ou avec lequel vous interagissez peuvent être mesurées.",
						"descriptionLegal": "Pour mesurer la performance du contenu, les partenaires peuvent:\n* Mesurer comment le contenu a été diffusé et comment les utilisateurs ont interagi avec, et générer des rapports.\n* Générer des rapports à l'aide d'informations directement mesurables ou connues, sur les utilisateurs qui ont interagi avec le contenu\nLes partenaires ne peuvent pas:\n* Mesurer si et comment des publicités (y compris des publicités natives) ont été présentées à un utilisateur et comment celui-ci a interagi avec, sans base légale distincte\n* Croiser des données d'audience, issues ou dérivées d'un panel, avec des données de mesure de performance, sans base légale pour titre \"Finalité 9\u201d. "
					},
					"9": {
						"id": 9,
						"name": "Exploiter des études de marché afin de générer des données d'audience",
						"description": "Les études de marché peuvent servir à en apprendre davantage sur les audiences qui visitent des sites/utilisent des applications et voient des publicités.",
						"descriptionLegal": "Pour utiliser des études de marché afin de générer des données d'audience, les partenaires peuvent:\n* Fournir des rapports agrégés aux annonceurs ou à leurs représentants sur les audiences exposées à leurs publicités, en utilisant des données issues d'un panel ou d'un autre dispositif.\n* Fournir des rapports agrégés aux éditeurs sur les audiences  exposées à des contenus et/ou des publicités ou qui ont interagi avec des contenus et/ou les publicités sur leurs sites, en utilisant des données issues d'un panel ou d'un autre dispositif. \n* Combiner des données hors ligne à celles d'un utilisateur en ligne dans le cadre d'études de marché pour générer des données d'audience si les partenaires ont déclaré faire correspondre et associer des sources de données hors ligne (Fonctionnalité 1)\n* Texte dans la version anglaise : Combiner ces informations avec des données déjà collectées que ce soit sur le web ou via des applications. \nLes partenaires ne peuvent pas : \n* Mesurer la performance et l'efficacité des publicités qui ont été présentées à un utilisateur en particulier, ou avec lesquelles il a interagi, sans s'appuyer sur une base légale spécifique pour la mesure de la performance publicitaire.\n* \u00c9valuer le contenu qui a été présenté à un utilisateur en particulier et la fa\u00e7on dont ce dernier a réagi sans s'appuyer sur une base légale spécifique pour la mesure de la performance des contenus.\n"
					},
					"10": {
						"id": 10,
						"name": "Développer et améliorer les produits",
						"description": "Vos données peuvent être utilisées pour améliorer les systèmes et logiciels existants et pour développer de nouveaux produits.",
						"descriptionLegal": "Pour développer de nouveaux produits et améliorer des produits existants, les partenaires peuvent:\n* Utiliser des informations pour améliorer leurs produits existants en y ajoutant de nouvelles fonctionnalités et pour développer de nouveaux produits\n* Créer de nouveaux modèles et algorithmes gr\u00e2ce au machine-learning \nLes partenaires ne peuvent pas:\n* Effectuer toute autre opération de traitement des données autorisée par une autre finalité dans le cadre de cette finalité\n"
					}
				},
				"specialPurposes": {
					"1": {
						"id": 1,
						"name": "Assurer la sécurité, prévenir la fraude et déboguer",
						"description": "Vos données peuvent être utilisées pour surveiller et prévenir les activités frauduleuses, et s'assurer que les systèmes et processus fonctionnent correctement et en toute sécurité.",
						"descriptionLegal": "Pour garantir la sécurité, prévenir la fraude et déboguer, les partenaires peuvent:\n* Veiller à ce que les données soient transmises en toute sécurité \n* Détecter et prévenir les activités malveillantes, frauduleuses, inappropriées ou illégales.\n* Assurer un fonctionnement correct et efficace des systèmes et des processus, y compris surveiller et améliorer la performance des systèmes et processus utilisés pour des finalités autorisées\nLes partenaires ne peuvent pas:\n* Effectuer, au titre de cette finalité, toute autre opération de traitement des données autorisée pour une finalité différente     .\nRemarque: Les données collectées et utilisées pour assurer la sécurité, prévenir la fraude et déboguer peuvent inclure des caractéristiques d'appareil envoyées automatiquement à des fins d'identification, des données de géolocalisation précises et des données obtenues par l'analyse active des caractéristiques de l'appareil à des fins d'identification sans notification distincte et/ou opt-in distinct     \n"
					},
					"2": {
						"id": 2,
						"name": "Diffuser techniquement les publicités ou le contenu",
						"description": "Votre terminal peut recevoir et envoyer des informations qui vous permettent de voir des publicités et du contenu et d'interagir avec eux.",
						"descriptionLegal": "Pour fournir des informations et répondre aux appels techniques, les partenaires peuvent:\n* Utiliser l'adresse IP d'un utilisateur pour diffuser une publicité sur Internet\n* Réagir à l'interaction d'un utilisateur avec une publicité en dirigeant l'utilisateur vers une page d'accueil\n* Utiliser l'adresse IP d'un utilisateur pour diffuser du contenu sur Internet\n* Réagir à l'interaction d'un utilisateur avec du contenu en dirigeant l'utilisateur vers une page d'accueil\n* Utiliser des informations sur le type de terminal et les capacités du terminal pour présenter des publicités ou du contenu, par exemple, pour présenter une publicité à la bonne taille ou une vidéo dans un format pris en charge par le terminal     \nLes partenaires ne peuvent pas:\n* Effectuer, au titre de cette finalité, toute autre opération de traitement des données autorisée pour une finalité différente     \n"
					}
				},
				"features": {
					"1": {
						"id": 1,
						"name": "Mettre en correspondance et combiner des sources de données hors ligne",
						"description": "Les données issues de sources de données hors ligne peuvent être combinées à votre activité en ligne à l'appui d'une ou de plusieurs finalités.",
						"descriptionLegal": "Les partenaires peuvent : \n* Combiner des données obtenues hors ligne avec des données collectées en ligne à l'appui d'une ou de plusieurs Finalités ou Finalités spéciales.\n"
					},
					"2": {
						"id": 2,
						"name": "Relier différents terminaux",
						"description": "Différents terminaux peuvent être identifiés comme vous appartenant ou appartenant à votre foyer à l'appui d'une ou de plusieurs finalités",
						"descriptionLegal": "Les partnenaires peuvent :\n* Déterminer, selon une approche déterministe, que deux terminaux ou plus appartiennent au même utilisateur ou au même foyer\n* Déterminer, selon une approche probabiliste, que deux terminaux ou plus appartiennent au même utilisateur ou au même foyer\n* Analyser activement les caractéristiques du terminal pour l'identification probabiliste si les utilisateurs ont autorisé les partenanaires à analyser activement les caractéristiques du terminal pour l'identification (Fonctionnalité spéciale 2)\n"
					},
					"3": {
						"id": 3,
						"name": "Recevoir et utiliser des caractéristiques d'identification d'appareil envoyées automatiquement",
						"description": "Votre appareil peut être distingué d'autres appareils en fonction des informations qu'il envoie automatiquement, telles que l'adresse IP ou le type de navigateur.",
						"descriptionLegal": "Les partenaires peuvent :\n* Créer un identifiant à l'aide des données collectées automatiquement à partir d'un appareil pour des caractéristiques spécifiques ; par ex., adresse IP, cha\u00eene d'agent utilisateur.\n* Utiliser cet identifiant pour réidentifier un appareil.\nLes partenaires ne peuvent pas :\n* Créer un identifiant à l'aide des données collectées via une analyse active d'un terminal pour l'identification de caractéristiques spécifiques (par exemple, des polices installées ou la résolution d'écran) sans une adhésion distincte de l'utilisateur à l'analyse active des caractéristiques de l'appareil à des fins d'identification.\n* Utiliser cet identifiant pour ré-identifier un terminal.\n"
					}
				},
				"specialFeatures": {
					"1": {
						"id": 1,
						"name": "Utiliser des données de géolocalisation précises",
						"description": "Vos données de géolocalisation précises peuvent être utilisées à l'appui d'une ou de plusieurs finalités. Cela signifie que votre localisation peut être précise à plusieurs mètres près.",
						"descriptionLegal": "Les partnenaires peuvent :\n* Collecter et traiter des données de géolocalisation précises à l'appui d'une ou de plusieurs finalités.\nN.B. Une géolocalisation précise signifie qu'il n'y a aucune restriction à la précision de la localisation d'un utilisateur ; elle peut être précise à quelques mètres près.\n"
					},
					"2": {
						"id": 2,
						"name": "Analyser activement les caractéristiques du terminal pour l'identification",
						"description": "Votre terminal peut être identifié sur la base d'une analyse de la combinaison unique de caractéristiques de votre terminal.",
						"descriptionLegal": "Les partenaires peuvent :\n* Créer un identifiant à l'aide des données collectées via une analyse active d'un terminal pour l'identification de caractéristiques spécifiques, par exemple des polices installées ou la résolution d'écran. \n* Utiliser cet identifiant pour ré-identifier un terminal.\n"
					}
				},
				"stacks": {
					/*"1": {
						"id": 1,
						"purposes": [],
						"specialFeatures": [1, 2],
						"name": "Données de géolocalisation précises et identification par analyse du terminal",
						"description": "Des informations de géolocalisation précises et des informations sur les caractéristiques de l'appareil peuvent être utilisées."
					},
					"2": {
						"id": 2,
						"purposes": [2, 7],
						"specialFeatures": [],
						"name": "Publicités standards et mesure de performance des publicités",
						"description": "Des publicités standards peuvent être diffusées. La performance des publicités peut être mesurée."
					},
					"3": {
						"id": 3,
						"purposes": [2, 3, 4],
						"specialFeatures": [],
						"name": "Publicités personnalisées",
						"description": "Les publicités peuvent être personnalisées sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités."
					},
					"4": {
						"id": 4,
						"purposes": [2, 7, 9],
						"specialFeatures": [],
						"name": "Publicités standards et mesure de performance des publicités",
						"description": "Des publicités standards peuvent être diffusées. La performance des publicités peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"5": {
						"id": 5,
						"purposes": [2, 3, 7],
						"specialFeatures": [],
						"name": "Publicités standards, profil de publicités personnalisées et mesure de performance des publicités",
						"description": "Des publicités standards peuvent être diffusées. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités. La performance des publicités peut être mesurée."
					},
					"6": {
						"id": 6,
						"purposes": [2, 4, 7],
						"specialFeatures": [],
						"name": "Affichage de publicités personnalisées et mesure de performance des publicités",
						"description": "Les publicités peuvent être personnalisées sur la base d'un profil. La performance des publicités peut être mesurée."
					},
					"7": {
						"id": 7,
						"purposes": [2, 4, 7, 9],
						"specialFeatures": [],
						"name": "Affichage de publicités personnalisées, mesure de performance des publicités, et données d'audience",
						"description": "Les publicités peuvent être personnalisées sur la base d'un profil. La performance des publicités peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"8": {
						"id": 8,
						"purposes": [2, 3, 4, 7],
						"specialFeatures": [],
						"name": "Publicités personnalisées et mesure de performance des annonces",
						"description": "Les publicités peuvent être personnalisées sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités. La performance des publicités peut être mesurée."
					},
					"9": {
						"id": 9,
						"purposes": [2, 3, 4, 7, 9],
						"specialFeatures": [],
						"name": "Publicités personnalisées, mesure de performance des publicités, et données d'audience",
						"description": "Les publicités peuvent être personnalisées sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités. La performance des publicités peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"10": {
						"id": 10,
						"purposes": [3, 4],
						"specialFeatures": [],
						"name": "Profil de publicités personnalisées et affichage",
						"description": "Les publicités peuvent être personnalisées sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités. "
					},
					"11": {
						"id": 11,
						"purposes": [5, 6],
						"specialFeatures": [],
						"name": "Contenu personnalisé",
						"description": "Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu."
					},
					"12": {
						"id": 12,
						"purposes": [6, 8],
						"specialFeatures": [],
						"name": "Affichage de contenu personnalisé et mesure de performance du contenu",
						"description": "Le contenu peut être personnalisé sur la base d'un profil. La performance du contenu peut être mesurée."
					},
					"13": {
						"id": 13,
						"purposes": [6, 8, 9],
						"specialFeatures": [],
						"name": "Affichage de contenu personnalisé, mesure de performance du contenu et données d'audience",
						"description": "Le contenu peut être personnalisé sur la base d'un profil. La performance du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"14": {
						"id": 14,
						"purposes": [5, 6, 8],
						"specialFeatures": [],
						"name": "Contenu personnalisé et mesure de performance du contenu",
						"description": "Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance du contenu peut être mesurée."
					},
					"15": {
						"id": 15,
						"purposes": [5, 6, 8, 9],
						"specialFeatures": [],
						"name": "Contenu personnalisé, mesure de performance du contenu et données d'audience",
						"description": "Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"16": {
						"id": 16,
						"purposes": [5, 6, 8, 9, 10],
						"specialFeatures": [],
						"name": "Contenu personnalisé, mesure de performance du contenu, données d'audience, et développement produit",
						"description": "Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, des systèmes et logiciels"
					},
					"17": {
						"id": 17,
						"purposes": [7, 8, 9],
						"specialFeatures": [],
						"name": "Mesure de performance des annonces et du contenu et données d'audience",
						"description": "La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"18": {"id": 18, "purposes": [7, 8], "specialFeatures": [], "name": "Mesure de performance des publicités et du contenu", "description": "La performance des publicités et du contenu peut être mesurée."},
					"19": {
						"id": 19,
						"purposes": [7, 9],
						"specialFeatures": [],
						"name": "Mesure de performance des publicités      et données d'audience",
						"description": "La performance des publicités peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu"
					},
					"20": {
						"id": 20,
						"purposes": [7, 8, 9, 10],
						"specialFeatures": [],
						"name": "Mesure de performance des publicités et du contenu, données d'audience, et développement produit",
						"description": "La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"21": {
						"id": 21,
						"purposes": [8, 9, 10],
						"specialFeatures": [],
						"name": "Mesure de performance du contenu, données d'audience, et développement produit.",
						"description": "La performance du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					},
					"22": {
						"id": 22,
						"purposes": [8, 10],
						"specialFeatures": [],
						"name": "Mesure de performance du contenu, et développement produit",
						"description": "La performance du contenu peut être mesurée. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					},
					"23": {
						"id": 23,
						"purposes": [2, 4, 6, 7, 8],
						"specialFeatures": [],
						"name": "Affichage de publicités et de contenu personnalisés, mesure de performance des publicités et du contenu",
						"description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. La performance des publicités et du contenu peut être mesurée."
					},
					"24": {
						"id": 24,
						"purposes": [2, 4, 6, 7, 8, 9],
						"specialFeatures": [],
						"name": "Affichage de publicités et de contenu personnalisés, mesure de performance des publicités et du contenu, et données d'audience",
						"description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					},
					"25": {
						"id": 25,
						"purposes": [2, 3, 4, 5, 6, 7, 8],
						"specialFeatures": [],
						"name": "Publicités et contenu personnalisés, mesure de performance des publicités et du contenu",
						"description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités et le contenu. La performance des publicités et du contenu peut être mesurée."
					},
					"26": {
						"id": 26,
						"purposes": [2, 3, 4, 5, 6, 7, 8, 9],
						"specialFeatures": [],
						"name": "Publicités et contenu personnalisés, mesure de performance des publicités et du contenu, et données d'audience",
						"description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser les publicités et le contenu. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"27": {"id": 27, "purposes": [3, 5], "specialFeatures": [], "name": "Publicités personnalisées et profil de contenu", "description": "Des données supplémentaires peuvent être ajoutées pour personnaliser les publicités et le contenu. "},
					"28": {"id": 28, "purposes": [2, 4, 6], "specialFeatures": [], "name": "Affichage de publicités et de contenu personnalisés", "description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. "},
					"29": {
						"id": 29,
						"purposes": [2, 7, 8, 9],
						"specialFeatures": [],
						"name": "Publicités standards, mesure de performance des publicités et du contenu, et données d'audience",
						"description": "Des publicités standards peuvent être diffusées. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"30": {
						"id": 30,
						"purposes": [2, 4, 5, 6, 7, 8, 9],
						"specialFeatures": [],
						"name": "Affichage de publicités personnalisées, contenu personnalisé, mesure de performance des publicités et du contenu, et données d'audience",
						"description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},*/
					"31": {
						"id": 31,
						"purposes": [2, 4, 5, 6, 7, 8, 9, 10],
						"specialFeatures": [],
						"name": "Affichage de publicités personnalisées, contenu personnalisé, mesure de performance des publicités et du contenu, données d'audience et développement de produit",
						"description": "Les publicités et le contenu peuvent être personnalisés sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					},
					/*"32": {
						"id": 32,
						"purposes": [2, 5, 6, 7, 8, 9],
						"specialFeatures": [],
						"name": "Publicités standards, contenu personnalisé, mesure de performance des publicités et du contenu, et données d'audience",
						"description": "Des publicités standards peuvent être diffusées. Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"33": {
						"id": 33,
						"purposes": [2, 5, 6, 7, 8, 9, 10],
						"specialFeatures": [],
						"name": "Publicités standards, contenu personnalisé, mesure de performance des publicités et du contenu, données d'audience, et développement produit",
						"description": "Des publicités standards peuvent être diffusées. Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					},
					"34": {
						"id": 34,
						"purposes": [2, 5, 6, 8, 9],
						"specialFeatures": [],
						"name": "Publicités standards, contenu personnalisé, mesure de performance du contenu, et données d'audience",
						"description": "Des publicités standards peuvent être diffusées. Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités et du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu."
					},
					"35": {
						"id": 35,
						"purposes": [2, 5, 6, 8, 9, 10],
						"specialFeatures": [],
						"name": "Publicités standards, contenu personnalisé, mesure de performance du contenu, données d'audience et développement de produit ",
						"description": "Des publicités standards peuvent être diffusées. Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance du contenu peut être mesurée. Des informations peuvent être générées sur les audiences      qui ont vu les publicités et le contenu. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					},
					"36": {
						"id": 36,
						"purposes": [2, 5, 6, 7],
						"specialFeatures": [],
						"name": "Publicités standard, contenu personnalisé et mesure de performance des publicités",
						"description": "Des publicités standards peuvent être diffusées. Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités peut être mesurée."
					},
					"37": {
						"id": 37,
						"purposes": [2, 5, 6, 7, 10],
						"specialFeatures": [],
						"name": "Publicités standards, contenu personnalisé, mesure de performance des publicités, et développement produit",
						"description": "Des publicités standards peuvent être diffusées. Le contenu peut être personnalisé sur la base d'un profil. Des données supplémentaires peuvent être ajoutées pour mieux personnaliser le contenu. La performance des publicités peut être mesurée. Les données peuvent être utilisées pour créer ou améliorer l'expérience utilisateur, les systèmes et les logiciels."
					}*/
				}
			}
		}
	},

	/** Cookie **/
	cookie: {
		vendorCookieName: 'euconsent-v2',
		_readCookie: function (name, cb) {
			var value = "; " + document.cookie;
			var parts = value.split("; " + name + "=");

			if (parts.length >= 2) {
				if (typeof cb === 'function') cb(parts.pop().split(';').shift());
				return parts.pop().split(';').shift();
			} else {
				if (typeof cb === 'function') cb('');
			}
		},
		_writeCookie: function (name, value, maxAgeSeconds, path, domain, secure) {
			var maxAge = maxAgeSeconds === null ? '' : ";max-age=" + maxAgeSeconds;
			var valDomain = domain === null ? '' : ';domain=' + domain;
			secure = (secure === null || secure === false) ? '' : ';secure';
			document.cookie = name + "=" + value + ";path=" + path + maxAge + valDomain + secure + ";samesite=lax;";
			this.saveVerification(name);
		},
		_readGlobalCookie: function (name, cb) {
			cmp_pv.portal.sendPortalCommand({
				command: 'readVendorConsent'
			}, function (data) {
				cb((typeof data === 'object') ? '' : data);
			});
		},
		_writeGlobalCookie: function (name, value) {
			cmp_pv.portal.sendPortalCommand({
				command: 'writeVendorConsent',
				encodedValue: value
			}, function () {
				cmp_pv.cookie.saveVerification(name);
			});
		},
		loadCookie: function (cb) {
			var fnct = (cmp_pv.conf.hasGlobalScope) ? '_readGlobalCookie' : '_readCookie';
			this[fnct](this.vendorCookieName, function (data) {
				cb(("undefined" !== typeof data) ? cmp_pv.consentString.decodeConsentString(data) : false);
			})
		},
		writeCookie: function () {
			var data = cmp_pv.consentString.generateConsentString();
			var fnct = (cmp_pv.conf.hasGlobalScope) ? '_writeGlobalCookie' : '_writeCookie';
			this[fnct](this.vendorCookieName, data, 33696000, '/', cmp_pv.conf.cookieDomain, cmp_pv.conf.cookieSecure);
		},
		saveConsent: function (all) {
			// Maj dates
			cmp_pv.consentString.data.coreString.lastUpdated = new Date();
			cmp_pv.consentString.data.coreString.cmpId = cmp_pv.consentString.const.CMP_ID;

			// Accepte tout
			if (typeof all != 'undefined') {
				var i;
				for (i = 1; i <= cmp_pv.consentString.data.coreString.vendorConsent.maxVendorId; i++) {
					cmp_pv.consentString.data.coreString.vendorConsent.bitField[i] = all;
					cmp_pv.consentString.data.coreString.vendorLegitimateInterest.bitField[i] = all;
				}
				for (i = 1; i <= cmp_pv.consentString.data.specific.vendorConsent.maxVendorId; i++) {
					cmp_pv.consentString.data.specific.vendorConsent.bitField[i] = all;
				}
				for (i in cmp_pv.consentString.data.coreString.purposesConsent) {
					cmp_pv.consentString.data.coreString.purposesConsent[i] = all;
					cmp_pv.consentString.data.publisherTC.pubPurposesConsent[i] = all;
					if (i > 1) cmp_pv.consentString.data.coreString.purposesLITransparency[i] = all;
					if (i > 1) cmp_pv.consentString.data.publisherTC.pubPurposesLITransparency[i] = all;
				}
				for (i in cmp_pv.consentString.data.coreString.specialFeatureOptIns) {
					cmp_pv.consentString.data.coreString.specialFeatureOptIns[i] = all;
				}
				var matches = document.querySelectorAll("#step2 input");
				for (i = 0; i < matches.length; i++) {
					matches[i].checked = all;
				}
			}

			// Save cookies
			this.writeCookie();
			if (cmp_pv.conf.googleAC) this.saveGoogleAC(all);

			// Hide UI
			cmp_pv.ui.show(false);

			// Process commands
			cmp_pv.cmpReady = true;
			cmp_pv.processCommandQueue();

			// Fire useractioncomplete event
			cmp_pv.event.send('useractioncomplete');
		},
		loadConsent: function (cb) {
			var cb2;
			if (cmp_pv.conf.googleAC) {
				cb2 = function (data) {
					cmp_pv.cookie.loadGoogleAC();
					cb(data);
				}
			} else {
				cb2 = cb;
			}
			this.loadCookie(cb2);
		},
		saveVerification: function (name) {
			try {
				localStorage.setItem(name, new Date().toString());
			} catch (e) {
			}
		},
		lastVerification: function (name) {
			try {
				var date = localStorage.getItem(name);
				return (date) ? Date.parse(date) : new Date();
			} catch (e) {
				return new Date();
			}
		},
		saveGoogleAC: function (all) {
			// Accepte tout
			if (typeof all == 'undefined') {
				all = null;
			}
			// Create AC String
			var data = '1~';
			if (all === null || all === true) {
				for (var i = 0; i < cmp_pv.googleACList.length; i++) {
					var id = cmp_pv.googleACList[i][0];
					if (all || cmp_pv.consentString.data.googleAC[id]) {
						data += id + '.'
					}
					if (all) cmp_pv.consentString.data.googleAC[id] = all;
				}
			}
			cmp_pv.consentString.data.acString = data;
			try {
				localStorage.setItem('google-ac', data);
			} catch (e) {
				this._writeCookie('google-ac', data, 33696000, '/', cmp_pv.conf.cookieDomain);
			}
		},
		loadGoogleAC: function () {
			cmp_pv.consentString.data.googleAC = {};
			var string;
			try {
				string = localStorage.getItem('google-ac');
			} catch (e) {
				string = this._readCookie('google-ac');
			}
			if (string == null) return;

			var parts = string.split('~');
			if (parts.length === 2) {
				var ids = parts[1].split('.');
				cmp_pv.consentString.data.googleAC = {};
				for (var i = 0; i < ids.length; i++) {
					cmp_pv.consentString.data.googleAC[ids[i]] = true;
				}
				cmp_pv.consentString.data.acString = string;
			}
		}
	},

	/** Consent String */
	consentString: {
		const: {
			VERSION_BIT_OFFSET: 0,
			VERSION_BIT_SIZE: 6,
			SEGMENT_BIT_SIZE: 3,
			SEGMENT_BIT_OFFSET: 0,
			CMP_ID: 222,
			CMP_VERSION: 2,

			coreString: [
				{name: 'version', type: 'int', numBits: 6, default: 2},
				{name: 'created', type: 'date', numBits: 36, default: new Date()},
				{name: 'lastUpdated', type: 'date', numBits: 36, default: new Date()},
				{
					name: 'cmpId', type: 'int', numBits: 12, default: function () {
						return cmp_pv.consentString.const.CMP_ID
					}
				},
				{
					name: 'cmpVersion', type: 'int', numBits: 12, default: function () {
						return cmp_pv.consentString.const.CMP_VERSION
					}
				},
				{name: 'consentScreen', type: 'int', numBits: 6, default: 1},
				{name: 'consentLanguage', type: '6bitchar', numBits: 12, default: 'FR'},
				{
					name: 'vendorListVersion', type: 'int', numBits: 12, default: function () {
						return cmp_pv.globalVendorList.vendorListVersion
					}
				},
				{
					name: 'tcfPolicyVersion', type: 'int', numBits: 6, default: function () {
						return cmp_pv.globalVendorList.tcfPolicyVersion
					}
				},
				{
					name: 'isServiceSpecific', type: 'int', numBits: 1, default: function () {
						return !cmp_pv.conf.hasGlobalScope
					}
				},
				{name: 'useNonStandardStacks', type: 'int', numBits: 1, default: 0},
				{
					name: 'specialFeatureOptIns', type: 'bits', numBits: 12, default: function () {
						return cmp_pv.consentString.defaultBits(false, this.numBits)
					}
				},
				{
					name: 'purposesConsent', type: 'bits', numBits: 24, default: function () {
						return cmp_pv.consentString.defaultBits(false, this.numBits)
					}
				},
				{
					name: 'purposesLITransparency', type: 'bits', numBits: 24, default: function () {
						var lit = cmp_pv.consentString.defaultBits(true, this.numBits);
						lit[1] = false;
						return lit;
					}
				},
				{name: 'purposeOneTreatment', type: 'int', numBits: 1, default: 0},
				{name: 'publisherCC', type: '6bitchar', numBits: 12, default: 'FR'},
				{
					name: ['vendorConsent', 'vendorLegitimateInterest'],
					fields: function (name) {
						cmp_pv.consentString.const._rangeVendor[2].default = function (obj) {
							return cmp_pv.consentString.defaultBits(name === 'vendorLegitimateInterest', obj.maxVendorId);
						}
						return cmp_pv.consentString.const._rangeVendor;
					}
				},
				{name: 'numPubRestrictions', type: 'int', numBits: 12, default: 0}/*,
				{
					name: 'pubRestrictions',
					type: 'list',
					listCount: function (obj) {
						return obj.numPubRestrictions;
					},
					fields: [
						{name: 'purposeId', type: 'int', numBits: 6, default: 0},
						{name: 'restrictionType', type: 'int', numBits: 2, default: 0},
					]
				}*/
			],
			disclosedVendors: [ //TODO: OOB only global
				{name: 'segmentType', type: 'int', numBits: 3, default: 1},
				{
					name: ['disclosedVendors'],
					fields: this._rangeVendor
				}
			],
			allowedVendors: [ //TODO: OOB  only global
				{name: 'segmentType', type: 'int', numBits: 3, default: 2},
				{
					name: ['allowedVendors'],
					fields: this._rangeVendor
				}
			],
			publisherTC: [
				{name: 'segmentType', type: 'int', numBits: 3, default: 3},
				{
					name: 'pubPurposesConsent', type: 'bits', numBits: 24, default: function () {
						return cmp_pv.consentString.defaultBits(false, this.numBits)
					}
				},
				{
					name: 'pubPurposesLITransparency', type: 'bits', numBits: 24, default: function () {
						var lit = cmp_pv.consentString.defaultBits(true, this.numBits);
						lit[1] = false;
						return lit;
					}
				},
				{name: 'numCustomPurposes', type: 'int', numBits: 6, default: 0},
				{
					name: 'customPurposesConsent', type: 'bits', numBits: function (obj) {
						return obj.numCustomPurposes;
					}, default: function (obj) {
						return cmp_pv.consentString.defaultBits(false, obj.numberCustomPurposes)
					}
				},
				{
					name: 'customPurposesLITransparency', type: 'bits', numBits: function (obj) {
						return obj.numCustomPurposes;
					}, default: function (obj) {
						return cmp_pv.consentString.defaultBits(false, obj.numberCustomPurposes)
					}
				}
			],
			specific: [
				{name: 'segmentType', type: 'int', numBits: 3, default: 4},
				{
					name: ['vendorConsent'],
					fields: function () {
						cmp_pv.consentString.const._rangeVendor[0].default = function () {
							return cmp_pv.pubvendorOrder.length;
						}
						cmp_pv.consentString.const._rangeVendor[2].default = function (obj) {
							return cmp_pv.consentString.defaultBits(false, obj.maxVendorId);
						}
						return cmp_pv.consentString.const._rangeVendor;
					}
				}
			],

			_rangeVendor: [
				{
					name: 'maxVendorId', type: 'int', numBits: 16,
					default: function () {
						return parseInt(Object.keys(cmp_pv.globalVendorList.vendors).pop());
					}
				},
				{name: 'isRangeEncoding', type: 'int', numBits: 1, default: 0},
				{
					name: 'bitField', type: 'bits', numBits: function (obj) {
						return obj.maxVendorId;
					}, validator: function (obj) {
						return obj.isRangeEncoding === 0;
					}, default: function (obj) {
						return cmp_pv.consentString.defaultBits(true, obj.maxVendorId);
					}
				},
				{
					name: 'numEntries', type: 'int', numBits: 12, validator: function (obj) {
						return obj.isRangeEncoding === 1;
					}, default: 0
				},
				{
					name: 'rangeEntries', type: 'list', validator: function (obj) {
						return obj.isRangeEncoding === 1;
					}, listCount: function (obj) {
						return obj.numEntries;
					},
					fields: [
						{name: 'isARange', type: 'bool', numBits: 1},
						{name: 'startOrOnlyVendorId', type: 'int', numBits: 16},
						{
							name: 'endVendorId', type: 'int', numBits: 16, validator: function (obj) {
								return obj.isARange
							}
						}
					]
				}
			],

			// Autres
			SIX_BIT_ASCII_OFFSET: 65
		},
		data: {},

		decodeConsentString: function (cookieValue) {
			var res = this.decodeCookieData(cookieValue);
			if (res) {
				this.data.tcString = cookieValue;
				var data = this.data['coreString'];
				var names = ['vendorConsent', 'vendorLegitimateInterest'];
				for (var z = 0; z < names.length; z++) {
					var name = names[z];
					if (data[name].isRangeEncoding === 1) {
						var range, i, y;
						// Initialize bitField
						data[name].bitField = cmp_pv.consentString.defaultBits(false, data[name].maxVendorId);
						// Assign range value
						for (i = 0; i < data[name].rangeEntries.length; i++) {
							range = data[name].rangeEntries[i];
							if (range.isARange) {
								for (y = range.startOrOnlyVendorId; y <= range.endVendorId; y++) {
									data[name].bitField[y] = true;
								}
							} else {
								data[name].bitField[range.startOrOnlyVendorId] = true;
							}
						}
					}
				}
			}
			return res;
		},
		decodeCookieData: function (cookieValue) {
			if (cookieValue === '') return false;
			var parts = cookieValue.split('.');
			for (var i = 0; i < parts.length; i++) {
				var bitString = this.decodeBase64UrlSafe(parts[i]);
				var part = 'coreString';
				if (i > 0) {
					var segmentType = this.decodeBitsToInt(bitString, this.const.SEGMENT_BIT_OFFSET, this.const.SEGMENT_BIT_SIZE);
					switch (segmentType) {
						case 1:
							part = 'disclosedVendors';
							break;
						case 2:
							part = 'allowedVendors';
							break;
						case 3:
							part = 'publisherTC';
							break;
						case 4:
							part = 'specific';
							break;
						default:
							continue;
					}
				} else {
					var cookieVersion = this.decodeBitsToInt(bitString, this.const.VERSION_BIT_OFFSET, this.const.VERSION_BIT_SIZE);
					if (typeof cookieVersion !== 'number') {
						console.error('Could not find cookieVersion to decode');
						return false;
					}
				}

				this.data[part] = this.decodeConsentData(this.const[part], bitString, 0).obj;
			}

			if (typeof this.data['publisherTC'] === 'undefined') this.data['publisherTC'] = this.generateData(this.const['publisherTC']);
			if (typeof this.data['specific'] === 'undefined') {
				cmp_pv._fetchPubVendorList();
				this.data['specific'] = this.generateData(this.const['specific']);
			}
			return true;
		},
		generateConsentString: function () {
			// Core
			var string = '';
			var names = ['vendorConsent', 'vendorLegitimateInterest'];
			var data = this.data['coreString'];
			for (var i = 0; i < names.length; i++) {
				var name = names[i];
				data[name] = Object.assign(data[name], this.convertVendorsToRanges(data, name));
				// Range test
				var inputBitsRange = this.encodeConsentData(this.const._rangeVendor, Object.assign(data[name], {isRangeEncoding: 1}));
				var inputBits = this.encodeConsentData(this.const._rangeVendor, Object.assign(data[name], {isRangeEncoding: 0}));
				data[name].isRangeEncoding = (inputBits.length > inputBitsRange.length) ? 1 : 0;
			}
			inputBits = this.encodeConsentData(this.const.coreString, data);
			string = this.encodeBase64UrlSafe(inputBits);

			// Publisher, Specific
			names = ['publisherTC', 'specific'];
			for (i = 0; i < names.length; i++) {
				inputBits = this.encodeConsentData(this.const[names[i]], this.data[names[i]]);
				string += '.' + this.encodeBase64UrlSafe(inputBits);
			}

			return string;
		},
		getConsentString: function () {
			if (typeof this.data.tcString == 'undefined') {
				this.data.tcString = this.generateConsentString();
			}

			return this.data.tcString;
		},
		padLeft: function (string, padding) {
			return this.repeat(Math.max(0, padding), "0") + string;
		},
		padRight: function (string, padding) {
			return string + this.repeat(Math.max(0, padding), "0");
		},
		repeat: function (count, string) {
			var padString = '';
			for (var i = 0; i < count; i++) {
				padString += string;
			}
			return padString;
		},
		decodeBitsToInt: function (bitString, start, length) {
			return parseInt(bitString.substr(start, length), 2);
		},
		decodeBitsToDate: function (bitString, start, length) {
			return new Date(this.decodeBitsToInt(bitString, start, length) * 100);
		},
		decodeBitsToBool: function (bitString, start) {
			return parseInt(bitString.substr(start, 1), 2) === 1;
		},
		decode6BitCharacters: function (bitString, start, length) {
			var decoded = '';
			var decodeStart = start;
			while (decodeStart < start + length) {
				decoded += String.fromCharCode(this.const.SIX_BIT_ASCII_OFFSET + this.decodeBitsToInt(bitString, decodeStart, 6));
				decodeStart += 6;
			}
			return decoded;
		},
		decodeBase64UrlSafe: function (value) {
			// Replace safe characters
			var unsafe = value
				.replace(/-/g, '+')
				.replace(/_/g, '/') + '=='.substring(0, (3 * value.length) % 4);
			var bitString = "";

			try {
				var bytes = atob(unsafe);
				for (var i = 0; i < bytes.length; i++) {
					var bitS = bytes.charCodeAt(i).toString(2);
					bitString += this.padLeft(bitS, 8 - bitS.length);
				}
			} catch (error) {
				console.error(error);
			}

			return bitString;
		},
		decodeConsentData: function (fields, bitString, start) {
			var obj = {};
			var i, z, y, field, length;
			var totalLength = 0;
			for (i = 0; i < fields.length; i++) {
				field = fields[i];
				if (Array.isArray(field.name)) {
					length = 0;
					for (y = 0; y < field.name.length; y++) {
						decodedObj = this.decodeConsentData(field.fields(), bitString, start + length);
						obj[field.name[y]] = decodedObj.obj;
						length += decodedObj.length;
					}
				} else {
					if ('function' === typeof field.validator && !field.validator(obj)) continue;
					length = ('function' === typeof field.numBits) ? field.numBits(obj) : field.numBits;
					switch (field.type) {
						case 'int':
							obj[field.name] = this.decodeBitsToInt(bitString, start, length);
							break;
						case 'date':
							obj[field.name] = this.decodeBitsToDate(bitString, start, length);
							break;
						case '6bitchar':
							obj[field.name] = this.decode6BitCharacters(bitString, start, length);
							break;
						case 'bool':
							obj[field.name] = this.decodeBitsToBool(bitString, start);
							break;
						case 'bits':
							z = 1;
							obj[field.name] = {};
							for (y = start; y < start + length; y++) {
								obj[field.name][z] = this.decodeBitsToBool(bitString, y);
								z++;
							}
							break;
						case 'list':
							var listCount = field.listCount(obj);
							length = 0;
							obj[field.name] = [];
							for (z = 0; z < listCount; z++) {
								var decodedObj = this.decodeConsentData(field.fields, bitString, start + length);
								length += decodedObj.length;
								obj[field.name].push(decodedObj.obj);
							}
							break;
						default:
							console.warn("Cookie definition field found without encoder or type: %s", field.name);
					}
				}
				totalLength += length;
				start += length;
			}

			return {obj: obj, length: totalLength};
		},
		encodeIntToBits: function (number, numBits) {
			var bitString = '';

			if (typeof number === 'boolean') {
				number = number ? 1 : 0;
			}

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
		encodeBoolToBits: function (value) {
			return this.encodeIntToBits(value === true ? 1 : 0, 1);
		},
		encodeDateToBits: function (date, numBits) {
			if (date instanceof Date) {
				return this.encodeIntToBits(date.getTime() / 100, numBits);
			}
			return this.encodeIntToBits(date, numBits);
		},
		encode6BitCharacters: function (string, numBits) {
			var encoded = typeof string !== 'string' ? '' : string.split('').map(function (char) {
				var int = Math.max(0, char.toUpperCase().charCodeAt(0) - cmp_pv.consentString.const.SIX_BIT_ASCII_OFFSET);
				return cmp_pv.consentString.encodeIntToBits(int > 25 ? 0 : int, 6);
			}).join('');
			return this.padRight(encoded, numBits).substr(0, numBits);
		},
		encodeBase64UrlSafe: function (binaryValue) {
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
		encodeConsentData: function (fields, datas) {
			var inputBits = "";
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i];
				if (Array.isArray(field.name)) {
					for (var x = 0; x < field.name.length; x++) {
						inputBits += this.encodeConsentData(field.fields(), datas[field.name[x]]);
					}
				} else {
					// if ('function' === typeof field.fields) inputBits += this.encodeConsentData(field.fields(), datas);
					if ('function' === typeof field.validator && !field.validator(datas)) continue;
					var length = ('function' === typeof field.numBits) ? field.numBits(datas) : field.numBits;
					switch (field.type) {
						case 'int':
							inputBits += this.encodeIntToBits(datas[field.name], length);
							break;
						case 'date':
							inputBits += this.encodeDateToBits(datas[field.name], length);
							break;
						case '6bitchar':
							inputBits += this.encode6BitCharacters(datas[field.name], length);
							break;
						case 'bool':
							inputBits += this.encodeBoolToBits(datas[field.name]);
							break;
						case 'bits':
							var data = datas[field.name];
							for (var y = 1; y <= length; y++) {
								inputBits += this.encodeBoolToBits(data[y]);
							}
							break;
						case 'list':
							for (var z = 0; z < datas[field.name].length; z++) {
								inputBits += this.encodeConsentData(field.fields, datas[field.name][z]);
							}
							break;
						default:
							console.warn("Cookie definition field found without encoder or type: %s", field.name);
					}
				}
			}
			return inputBits;
		},
		defaultBits: function (val, numBits) {
			var obj = {};
			for (var i = 1; i <= numBits; i++) {
				obj[i] = val;
			}
			return obj;
		},
		generateConsentData: function () {
			var obj = {};
			obj.coreString = this.generateData(this.const['coreString']);
			obj.publisherTC = this.generateData(this.const['publisherTC']);
			obj.specific = this.generateData(this.const['specific']);
			if (cmp_pv.conf.googleAC) obj.googleAC = {};
			return obj;
		},
		generateData: function (fields) {
			var obj = {};
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i];
				if (Array.isArray(field.name)) {
					for (var y = 0; y < field.name.length; y++) {
						obj[field.name[y]] = this.generateData(field.fields(field.name[y]));
					}
				} else {
					obj[field.name] = ('function' === typeof field.default) ? field.default(obj) : field.default;
				}
			}
			return obj;
		},
		convertVendorsToRanges: function (data, name) {
			var range = [];
			var rangeType = true;
			var ranges = {false: [], true: []};
			for (var id = 1; id <= data[name].maxVendorId; id++) {
				if (data[name].bitField[id] === rangeType) {
					range.push(id);
				}
				// Range has ended or at the end of vendors list => add range entry
				if (data[name].bitField[id] !== rangeType || id === data[name].maxVendorId) {
					if (range.length) {
						var startOrOnlyVendorId = range.shift();
						var endVendorId = range.pop();
						range = [];
						ranges[rangeType].push({
							isARange: typeof endVendorId === 'number',
							startOrOnlyVendorId: startOrOnlyVendorId,
							endVendorId: endVendorId
						})
					}
				}
			}
			return {rangeEntries: ranges[rangeType], numEntries: ranges[rangeType].length};
		}
	},

	/** Portal **/
	portal: {
		globalVendorPortal: false,
		portalQueue: {},
		portalCallCount: 0,
		openGlobalVendorPortal: function (cb) {
			// Only ever create a single iframe
			if (!this.globalVendorPortal) {
				var url = cmp_pv.conf.globalConsentLocation;
				var iframe = document.createElement('iframe');
				iframe.setAttribute('style', 'width:1px;height:1px;position:absolute;left:-99px;top:-99px;');
				iframe.setAttribute('src', url);
				document.body.appendChild(iframe);

				var portalTimeout = setTimeout(function () {
					cb(new Error("Communication could not be established with the vendor domain within 5000 milliseconds"));
				}, 5000);

				// Add listener for messages from iframe
				window.addEventListener('message', function (event) {
					// Only look at messages with the vendorConsent property
					var data = event.data.vendorConsent;
					if (data) {
						// The iframe has loaded
						if (data.command === 'isLoaded' && portalTimeout) {
							clearTimeout(portalTimeout);
							portalTimeout = undefined;
							cmp_pv.portal.globalVendorPortal = iframe;
							cb(iframe);
						} else {
							// Resolve the promise mapped by callId
							var queued = cmp_pv.portal.portalQueue[data.callId];
							if (queued) {
								delete cmp_pv.portal.portalQueue[data.callId];
								clearTimeout(queued.timeout);
								queued.cb(data.result);
							}
						}
					}
				});
			} else {
				return cb(this.globalVendorPortal);
			}
		},
		sendPortalCommand: function (message, cb) {
			// Increment counter to use as unique callId
			var callId = "vp:" + (++this.portalCallCount);

			// Make sure iframe is loaded
			this.openGlobalVendorPortal(function (iframe) {

				var timeout = setTimeout(function () {
					delete cmp_pv.portal.portalQueue[callId];
					cb(new Error(message.command + " response not received from vendor domain within 5000 milliseconds"));
				}, 5000);

				// Store the resolve function and timeout in the map
				cmp_pv.portal.portalQueue[callId] = {cb: cb, timeout: timeout};

				// Send the message to the portal
				iframe.contentWindow.postMessage({
					vendorConsent: Object.assign(
						{callId: callId},
						message
					)
				}, '*');
			});
		}
	},

	/** **/
	_fetchGlobalVendorList: function (callback) {
		var dt = new Date();
		cmp_pv._fetch(cmp_pv.conf.urlVendorList.replace('[RND]', dt.getFullYear() + dt.getMonth() + dt.getDate()), function (res) {
			try {
				if (res.status === 200) {
					cmp_pv.globalVendorList = JSON.parse(res.responseText);
					cmp_pv._fetchPubVendorList();
					cmp_pv.ui.sortVendors();
				} else {
					console.error("Can't fetch vendorlist: %d (%s)", res.status, res.statusText);
				}
			} catch (e) {
			}
			if (cmp_pv.conf.googleAC) {
				cmp_pv._fetchGoogleACList(callback);
			} else {
				callback();
			}
		});
	},

	_fetchGoogleACList: function (callback) {
		var dt = new Date();
		cmp_pv._fetch(cmp_pv.conf.urlGoogleACList.replace('[RND]', dt.getFullYear() + dt.getMonth() + dt.getDate()), function (res) {
			try {
				if (res.status === 200) {
					cmp_pv.googleACList = JSON.parse(res.responseText);
				} else {
					console.error("Can't fetch Google AC list: %d (%s)", res.status, res.statusText);
				}
			} catch (e) {
			}
			callback();
		});
	},

	_fetchPubVendorList: function () {
		cmp_pv.pubvendor = {
			1: {
				id: 1,
				name: 'Sofinco (par Numberly)',
				purposes: [1, 2, 3, 4, 5],
				legIntPurposes: [],
				specialPurposes: [],
				features: [],
				specialFeatures: [],
				policyUrl: 'https://www.sofinco.fr/organisme-credit/sofinco-informations-legales.htm#finalitecollecte',
				dep: 388
			}
		};
		cmp_pv.pubvendorOrder = [1];
	},

	_fetch: function (url, callback) {
		try {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function () {
				if (this.readyState === XMLHttpRequest.DONE) {
					callback(this);
				}
			};
			xhr.open("GET", url, true);
			xhr.send();
		} catch (e) {
			callback({status: 500, statusText: e});
		}
	}
};

window.__tcfapi = cmp_pv.processCommand;
cmp_pv.processCommandQueue();
