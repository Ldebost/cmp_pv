/**
 * == CMP ==
 **/
var cmp_pv = {
	/** Interface **/
	isLoaded: false,
	cmpReady: false,
	commandQueue: window.__cmp.a || [],
	processCommand: function(command, parameter, callback) {
		if (typeof cmp_pv.commands[command] !== 'function') {
			console.error("Invalid CMP command %s,", command);
		}
		if (!cmp_pv.cmpReady && command !== 'init' && command !== 'ping') {
			cmp_pv.commandQueue.push({
				command: command,
				parameter: parameter,
				callback: callback
			});
		} else {
			console.info("Proccess command: %s, parameter: %s", command, parameter);
			cmp_pv.commands[command](parameter, callback);
		}
	},
	processCommandQueue: function() {
		var queue = this.commandQueue;
		if (queue.length) {
			console.info("Process %d queued commands", queue.length);
			cmp_pv.commandQueue = [];
			for (var i = 0; i < queue.length; i++) {
				cmp_pv.processCommand(queue[i].command, queue[i].parameter, queue[i].callback);
			}
		}
	},

	/** Configuration **/
	conf: {
		gdprApplies: true,
		hasGlobalScope: false,
		cookieDomain: 'paruvendu.fr',
		publisherName: 'ParuVendu.fr',
		urlVendorList: 'https://vendorlist.consensu.org/vendorlist.json',
		urlCookiesUsage: 'https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#cookies',
		consentCallback: null,
		dayCheckInterval: 30,
		globalConsentLocation: 'http://cmp.paruvendu.consensu.org/portal.html'
	},

	/** Commandes **/
	commands: {
		init: function(options) {
			// Options
			cmp_pv.conf = Object.assign(cmp_pv.conf, options);

			// Already loaded
			if (cmp_pv.ui.dom !== null) return cmp_pv.ui.show(true);

			// Load consent
			cmp_pv.cookie.loadConsent(function(res) {
				// Not ready
				if (!res) {
					cmp_pv.ui.show();
				} else {
					// Ready
					cmp_pv.cmpReady = true;
					cmp_pv.processCommandQueue();
					// Ask consent every X days if globalVendorList.version has changed 
					if (parseInt((new Date() - cmp_pv.cookie.lastVerification(cmp_pv.cookie.vendorCookieName)) / (24 * 3600 * 1000)) >= cmp_pv.conf.dayCheckInterval) {
						cmp_pv._fetchGlobalVendorList(function() {
							if (cmp_pv.globalVendorList.vendorListVersion !== cmp_pv.consentString.data.vendorListVersion) {
								cmp_pv.ui.show(true);
							}
						});

						// Update checked time
						cmp_pv.cookie.saveVerification(cmp_pv.cookie.vendorCookieName);
					}
				}
			});
		},

		getVendorConsents: function(vendorIds, callback) {
			var vendorList = {};
			if (vendorIds && vendorIds.length) {
				for (var i = 0; i < vendorIds.length; i++) {
					vendorList[vendorIds[i]] = !!cmp_pv.consentString.data.bitField[vendorIds[i]];
				}
			} else {
				vendorList = cmp_pv.consentString.data.bitField;
			}
			var consent = {
				metadata: cmp_pv.consentString.generateVendorConsentMetadata(),
				gdprApplies: cmp_pv.conf.gdprApplies,
				hasGlobalScope: cmp_pv.conf.hasGlobalScope,
				purposeConsents: cmp_pv.consentString.data.purposesAllowed,
				vendorConsents: vendorList,
			};

			callback(consent, true);
		},

		getConsentData: function(consentStringVersion, callback) {
			if (!consentStringVersion) consentStringVersion = 1;
			var consent = null;
			if (typeof cmp_pv.consentString.const['vendor_' + consentStringVersion] !== 'undefined') {
				consent = {
					consentData: cmp_pv.consentString.generateVendorConsentString(),
					gdprApplies: cmp_pv.conf.gdprApplies,
					hasGlobalScope: cmp_pv.conf.hasGlobalScope,
				};
			}
			callback(consent, true);
		},

		ping: function(_, callback) {
			var result = {
				gdprAppliesGlobally: cmp_pv.conf.hasGlobalScope,
				cmpLoaded: true
			};
			callback(result, true);
		},

		getPublisherConsents: function(purposeIds, callback) {
			var standard = {};
			var custom = {};
			if (purposeIds && purposeIds.length) {
				var maxStandard = Object.keys(cmp_pv.consentString.dataPub.standardPurposesAllowed).length;
				for (var i = 0; i <= purposeIds.length; i++) {
					if (purposeIds[i] <= maxStandard) standard[purposeIds[i]] = !!cmp_pv.consentString.dataPub.standardPurposesAllowed[purposeIds[i]];
					else custom[purposeIds[i]] = !!cmp_pv.consentString.dataPub.customPurposesBitField[purposeIds[i]];
				}
			} else {
				standard = cmp_pv.consentString.dataPub.standardPurposesAllowed;
				custom = cmp_pv.consentString.dataPub.customPurposesBitField;
			}
			var consent = {
				metadata: '',
				gdprApplies: cmp_pv.conf.gdprApplies,
				hasGlobalScope: cmp_pv.conf.hasGlobalScope,
				standardPurposeConsents: standard,
				customPurposeConsents: custom,
			};
			callback(consent, true);
		},

		getVendorList: function(vendorListVersion, callback) {
			if (vendorListVersion !== null && cmp_pv.globalVendorList.version !== vendorListVersion && (typeof vendorListVersion === 'number' /*|| vendorListVersion === '?LATEST?'*/)) {
				return cmp_pv._fetch("https://vendorlist.consensu.org/v-" + vendorListVersion + "/vendorlist.json", function(res) {
					if (res.status === 200) {
						callback(JSON.parse(res.responseText), true);
					} else {
						callback(null, false);
					}
				});
			} else {
				callback(cmp_pv.globalVendorList, (cmp_pv.globalVendorList != null));
			}
		},

		showConsentUi: function(_, callback) {
			callback(cmp_pv.ui.show(true));
		},
	},

	/** UI **/
	ui: {
		dom: null,
		create: function(it) {
			// Security
			if (cmp_pv.ui.dom !== null) return cmp_pv.ui.show(true);

			if (typeof cmp_pv.globalVendorList === 'undefined') {
				cmp_pv._fetchGlobalVendorList(function() {
					if (it < 2) cmp_pv.ui.create(++it);
				});
			} else {
				if (cmp_pv.consentString.data.created === null) cmp_pv.consentString.data = cmp_pv.consentString.generateVendorConsentData();
				if (cmp_pv.consentString.dataPub.created === null) cmp_pv.consentString.dataPub = cmp_pv.consentString.generatePublisherConsentData();

				// Create UI
				cmp_pv.ui.dom = document.createElement('div');
				cmp_pv.ui.dom.id = "CMP_PV";
				cmp_pv.ui.dom.style.display = 'block';

				var css = '';
				css += '#CMP_PV {position: fixed; bottom: 0; background: #fafafa; color: #010101; padding: 5px 10px;font-family:Tahoma, Geneva, sans-serif; font-size: 14px;box-shadow: 0 0 5px #949494;width: calc(100% - 20px);z-index: 100;}';
				css += '#CMP_PV p{margin:0;}';
				css += '#CMP_PV a{color:#EE1C24; text-decoration: underline; cursor: pointer;}';
				css += '#CMP_PV a:hover{color:#D41920; text-decoration: none;}';
				css += '#CMP_PV button{background-color: #EE1C24;border: 2px solid #ee1c24;font-size: 20px;font-weight: bold;color: #fff;cursor: pointer;padding:5px; transition: background 300ms;}';
				css += '#CMP_PV button:hover{background-color: #FFF;color:#EE1C24;}';
				css += '#CMP_PV button.inverse{background-color: #FFF;color:#EE1C24;}';
				css += '#CMP_PV button.inverse:hover{background-color: #EE1C24;color:#FFF;}';
				css += '#CMP_PV .switch{position: relative;display: inline-block;width: 60px;height: 16px;cursor: pointer;}';
				css += '#CMP_PV .switch input {display:none;}';
				css += '#CMP_PV .slider{position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; -webkit-transition: .4s; transition: .4s;border-radius: 34px;height: 18px;}';
				css += '#CMP_PV .slider:before{position: absolute;content: "";height: 24px;width: 24px;left: 0;bottom: -4px;background-color: white;-webkit-transition: .4s;transition: .4s;border-radius: 50%;border:1px solid #aaa}';
				css += '#CMP_PV input:checked + .slider{background-color: #8BC34A;}';
				css += '#CMP_PV input:focus + .slider{box-shadow: 0 0 1px #8BC34A;}';
				css += '#CMP_PV input:checked + .slider:before {transform: translateX(34px);border-color:#7BAA44;}';
				css += '#CMP_PV #step1 .title{letter-spacing: -0.03em;color: #111;font-weight: bold;font-family: sans-serif;text-shadow: 1px 1px 1px #98989899;padding: 5px 0;}';
				css += '#CMP_PV #step1 .desc{display: table-row;}';
				css += '#CMP_PV #step1 .desc>*{display: table-cell;vertical-align: middle;}';
				css += '#CMP_PV #step1 .desc>button{min-width: 210px; text-align: center;margin: 5px 20px 5px 40px;}';
				css += '#CMP_PV #step1 .desc>p{text-align:justify;font-size: 13px;}';
				css += '#CMP_PV #step2 .container{max-width: 1000px; margin:0 auto;display: flex;}';
				css += '#CMP_PV #step2 .container:after{content:\'\';display:block;clear:both;}';
				css += '#CMP_PV #step2 .desc{background: white;box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);padding: 10px;box-sizing: border-box;margin-top:10px;align-items: center;font-size:13px;}';
				css += '#CMP_PV #step2 .desc>div{display: flex;}';
				css += '#CMP_PV #step2 .desc button{font-size: 16px;margin-left: 9px;white-space:nowrap;}';
				css += '#CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .vendors {list-style:none; box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);padding: 0;width: 50%;margin:0;}';
				css += '#CMP_PV #step2 .container .purposes li{border-bottom: 1px solid rgba(0, 0, 0, 0.11);background: #3c3c3c; color: white;}';
				css += '#CMP_PV #step2 .container .purposes li:last-child{border-bottom: none;}';
				css += '#CMP_PV #step2 .container .purposes li>h4:first-child{border-left: 3px solid transparent;}';
				css += '#CMP_PV #step2 .container .purposes li>h4 .arrow{padding: 0 16px 0 0;width: 28px;text-align: right;}';
				css += '#CMP_PV #step2 .container .purposes li>h4 .title{padding: 14px 8px;}';
				css += '#CMP_PV #step2 .container .purposes li>h4 .help{width: 15px;padding: 5px;line-height: 0;}';
				css += '#CMP_PV #step2 .container .purposes li>h4 .help:before{content:\'?\';border: 2px solid white;border-radius: 50%;display: inline-block;width: 17px;height: 17px;text-indent: 5px;line-height: 15px;}';
				css += '#CMP_PV #step2 .container .purposes li>h4 .arrow:after{content:\'\\276c\'; font-size: 25px;transition: all 0.5s;display: inline-block;height: 40px;}';
				css += '#CMP_PV #step2 .container .purposes li>h4{display:table;margin:0;font-weight:normal;cursor:pointer;height: 46px;width: 100%;}';
				css += '#CMP_PV #step2 .container .purposes li>h4:hover{background: #5f5f5f;}';
				css += '#CMP_PV #step2 .container .purposes li>h4>span{display: table-cell;vertical-align: middle;}';
				css += '#CMP_PV #step2 .container .purposes li>h4>label{display: table-cell;border-top: 14px solid transparent;border-bottom: 14px solid transparent;}';
				css += '#CMP_PV #step2 .container .purposes li.active>h4:first-child{border-left: 3px solid #F44336;}';
				css += '#CMP_PV #step2 .container .purposes li.active>h4 .arrow::after{transform: rotate(0.5turn);}';
				css += '#CMP_PV #step2 .container .purposes li>div{display:none;background: grey;font-size: small;padding: 5px;position: absolute;z-index: 3;margin: 0 20px;border: 2px solid white;border-radius: 10px;max-width: 500px;cursor:pointer;}';
				css += '#CMP_PV #step2 .container .purposes li>h4 .help:hover:before, #CMP_PV #step2 .container .purposes li>h4 .help:focus:before, #CMP_PV #step2 .container .purposes li>h4 .help:active:before{color:black;background-color:white;}';
				css += '#CMP_PV #step2 .container .vendors{background: white;position: relative;}';
				css += '#CMP_PV #step2 .container .vendors ul{list-style:none;}';
				css += '#CMP_PV #step2 .container .vendors li{padding: 2px 5px;}';
				css += '#CMP_PV #step2 .container .vendors li>span{display:inline-block; width: 80%;}';
				css += '#CMP_PV #step2 .container .vendors li .switch{height: 10px;width: 52px;}';
				css += '#CMP_PV #step2 .container .vendors li .slider{height: 10px;}';
				css += '#CMP_PV #step2 .container .vendors li .slider:before{height: 18px; width: 18px;bottom: -5px;}';
				css += '#CMP_PV #step2 .container .vendors.pid1 li:not(.pid1){display: none;}';
				css += '#CMP_PV #step2 .container .vendors.pid2 li:not(.pid2){display: none;}';
				css += '#CMP_PV #step2 .container .vendors.pid3 li:not(.pid3){display: none;}';
				css += '#CMP_PV #step2 .container .vendors.pid4 li:not(.pid4){display: none;}';
				css += '#CMP_PV #step2 .container .vendors.pid5 li:not(.pid5){display: none;}';
				css += '#CMP_PV #step2 .container .vendors_list{position: absolute;top: 59px;left: 0;right: 0;bottom: 0;overflow: auto;margin: 0;}';
				css += '#CMP_PV #step2 .buttons{text-align: right;display: block;position:relative;margin-top:10px;}';
				css += '#CMP_PV #step2 .buttons>a{position: absolute;left: 0;}';
				css += '#CMP_PV #step2 .buttons button{font-size: 16px;padding: 5px 15px;}';
				css += '#CMP_PV #step2 .vendors_head{position: absolute;top:0;left:0;right:0;}';
				css += '#CMP_PV #step2 .vendors_head>div>a{display:block;float:left;width:50%;padding:5px 0;text-align: center;border-bottom: 3px solid transparent;text-decoration:none;background:#515151;color:#ededed;}';
				css += '#CMP_PV #step2 .vendors_head>div>a.active{border-bottom: 3px solid #F44336;}';
				css += '#CMP_PV #step2 .vendors_head>div>div{display:block;float:left;width:50%;padding:5px 0;letter-spacing: 1px;font-variant: small-caps;box-sizing:border-box;}';
				css += '#CMP_PV #step2 .vendors_head>div:after{content:\'\';display:block;clear:both;}';
				css += '#CMP_PV #step2 .vendors_head>div:nth-child(2){box-shadow: 0 1px 2px #bfbfbf;}';
				css += '#CMP_PV #step2 .vendors_head>div>div:first-child{padding-left: 44px;width: 70%;}';
				css += '#CMP_PV #step2 .vendors_head>div>div:nth-child(2){width: 22%;padding-left: 41px;}';
				//Responsive
				css += '@media screen and (min-width: 1024px) {';
				css += '	#CMP_PV #step2 .container{width:1000px;}';
				css += '}';
				css += '@media screen and (max-width: 640px) {';
				css += '	#CMP_PV{padding:0;width:100%;}';
				css += '	#CMP_PV #step1{text-align: center;}';
				css += '	#CMP_PV #step1 .desc{display:block;padding: 0 10px 10px 10px;}';
				css += '	#CMP_PV #step1 .desc>p{display:block;font-size: 12px;}';
				css += '	#CMP_PV #step2 .desc>div{flex-flow: column;justify-content: space-evenly;}';
				css += '	#CMP_PV #step2 .desc{align-items: initial;}';
				css += '	#CMP_PV #step2 .buttons{margin: 10px;}';
				css += '	#CMP_PV #step2 #purpose_container{width:200%;max-width:initial;transition: transform .2s ease-in-out;}';
				css += '	#CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .vendors{width:46%;}';
				css += '	#CMP_PV #step2 .container .purposes li{width:auto;}';
				css += '	#CMP_PV #step2 .container .purposes li.active > h4 .arrow::after{transform: none;animation: bounce 0.6s ease-out;}';
				css += '	#CMP_PV #step2 > .container.showPurposes .purposes li > h4 .arrow::after{visibility: hidden;}';
				css += '	#CMP_PV #step2 > .container.showPurposes .purposes li.active > h4 .arrow::after{visibility: visible;transform: rotate(0.5turn);}';
				css += '	#CMP_PV #step2 > .container.showPurposes {transform: translate3d(-42%, 0, 0);}';
				css += '	#CMP_PV #step2 .container .vendors_list {padding: 0 5px;}';
				css += '	#CMP_PV #step2 .desc button:first-child{margin-bottom: 5px;}';
				css += '	@keyframes bounce{';
				css += '		0% {transform:translate3d(0,0,0);}';
				css += '		30% {transform:translate3d(5px,0,0);}';
				css += '		60% {transform:translate3d(0px,0,0);}';
				css += '		80% {transform:translate3d(2px,0,0);}';
				css += '		100% {transform:translate3d(0,0,0);}';
				css += '	}';
				css += '}';
				css += '@media screen and (max-width: 360px) {';
				css += '	#CMP_PV #step2 .desc{flex-direction: column;}';
				css += '	#CMP_PV #step2 .desc>div{flex-flow: row;}';
				css += '	#CMP_PV #step2 .desc button:first-child{margin-bottom: 0;}';
				css += '}';
				// Hack IE 9
				var ie = this.detectIE();
				if (ie > 0) {
					if (ie > 9) {
						css += '#CMP_PV #step2 .desc>p{width: calc(100% - 260px);}';
						css += '@media screen and (max-width: 640px) {';
						css += '	#CMP_PV #step2 .desc>p{width: calc(100% - 130px);}';
						css += '}';
					} else {
						css += '#CMP_PV #step2 .container{display:table;width:100%;}';
						css += '#CMP_PV #step2 .container:not(.buttons)>*{display:table-cell;}';
						css += '#CMP_PV #step2 .desc > div{display:table-cell;vertical-align:middle;width:260px;}';
						css += '#CMP_PV #step2 .container .vendors{overflow-y: auto;overflow-x: hidden;}';
						css += '#CMP_PV #step2 .container .vendors_list{overflow: visible; width: 460px; height:280px;}';
						css += '@media screen and (max-width: 640px) {';
						css += '	#CMP_PV #step2 .container .vendors_list{width: 100%;}';
						css += '}';
					}
				}

				var sheet = document.createElement('style');
				sheet.innerHTML = css;
				document.head.appendChild(sheet);

				var html = '';
				html += '<div id="step1">';
				html += '	<div class="title">Vos choix en matière de cookies</div>';
				html += '	<div class="desc">';
				html += '		<p>Nos partenaires et nous-mêmes utilisons différentes technologies, telles que les cookies, pour personnaliser les contenus et les publicités, proposer des fonctionnalités sur les réseaux sociaux et analyser le trafic. Merci de cliquer sur le bouton ci-dessous pour donner votre accord. Vous pouvez changer d\'avis et modifier vos choix à tout moment. <a onclick="cmp_pv.ui.showStep(2);">Afficher les utilisations prévues et les accepter ou les refuser</a>.</p>';
				html += '		<button onclick="cmp_pv.cookie.saveConsent(true);">J\'accepte</button>';
				html += '	</div>';
				html += '</div>';
				html += '<div id="step2" style="display: none;">';
				html += '	<div class="container desc">';
				html += '		<p>La collecte des données personnelles se fait en fonction des objectifs listés ci dessous. Vous pouvez configurer et choisir comment vous souhaitez que vos données personnelles soient utilisées de manière globale ou indépendemment pour chaque finalité et même pour chaque partenaire publicitaire. <a href="' + cmp_pv.conf.urlCookiesUsage + '" target="_blank">En savoir plus sur la gestion des cookies.</a></p>';
				html += '		<div>';
				html += '			<button onclick="cmp_pv.ui.switchAllPurpose(false);" class="inverse">Tout refuser</button>';
				html += '			<button onclick="cmp_pv.ui.switchAllPurpose(true);">Tout accepter</button>';
				html += '		</div>';
				html += '	</div>';
				html += '	<div class="container" id="purpose_container">';
				html += '		<ul class="purposes">';
				for (var i = 0; i < cmp_pv.globalVendorList.purposes.length; i++) {
					var purpose = cmp_pv.globalVendorList.purposes[i];
					html += '		<li id="purpose_' + purpose.id + '">';
					html += '			<h4><span class="help" id="em-' + purpose.id + '" onclick="cmp_pv.ui.showPurposeDescription(' + purpose.id + ');">&nbsp;</span><span class="title" onclick="cmp_pv.ui.showPurpose(' + purpose.id + ');">' + cmp_pv.ui.language['fr'].purposes[purpose.id].name + '</span><label class="switch"><input type="checkbox" onchange="cmp_pv.ui.switchPurpose(' + purpose.id + ', this.checked);"' + ((cmp_pv.consentString.data.purposesAllowed[purpose.id]) ? 'checked' : '') + '><span class="slider"></span></label><span class="arrow" onclick="cmp_pv.ui.showPurpose(' + purpose.id + ', true);"></span></h4>';
					html += '			<div><span>' + cmp_pv.ui.language['fr'].purposes[purpose.id].description + '</span></div>';
					html += '		</li>';
				}
				html += '		</ul>';
				html += '		<div id="vendors" class="vendors">';
				html += '			<div class="vendors_head">';
				html += '				<div>';
				html += '					<a id="vendors_0" class="active" href="javascript:cmp_pv.ui.showVendors(0);">Publicité</a>';
				html += '					<a id="vendors_1" href="javascript:cmp_pv.ui.showVendors(1);">' + cmp_pv.conf.publisherName + '</a>';
				html += '				</div>';
				html += '				<div>';
				html += '					<div>Partenaire</div>';
				html += '					<div>Statut</div>';
				html += '				</div>';
				html += '			</div>';
				html += '			<ul class="vendors_list" id="vendors_list_0">';
				for (var y = 0; y < cmp_pv.globalVendorList.vendors.length; y++) {
					var vendor = cmp_pv.globalVendorList.vendors[y];
					html += '			<li class="pid' + vendor.purposeIds.join(' pid') + '"><span>' + vendor.name + '</span><label class="switch"><input type="checkbox" value="' + vendor.id + '" ' + ((cmp_pv.consentString.data.bitField[vendor.id]) ? 'checked' : '') + ' onchange="cmp_pv.ui.switchVendor(' + vendor.id + ', this.checked);"><span class="slider"></span></label></li>';
				}
				html += '			</ul>';
				html += '			<ul class="vendors_list" id="vendors_list_1" style="display: none;">';
				html += '				<li class="pid1 pid3"><span>AT internet</span><label>Requis</label></li>';
				html += '				<li class="pid1 pid2"><span>Google Analytics</span><label>Requis</label></li>';
				html += '				<li class="pid1 pid2"><span>Google Tag Manager</span><label>Requis</label></li>';
				html += '			</ul>';
				html += '		</div>';
				html += '	</div>';
				html += '	<div class="container buttons">';
				html += '		<a href="javascript:cmp_pv.ui.showStep(1);">&lsaquo; Retour</a>';
				html += '		<button onclick="cmp_pv.cookie.saveConsent(false);">Enregistrer</button>';
				html += '	</div>';
				html += '</div>';
				cmp_pv.ui.dom.innerHTML = html;
				document.body.appendChild(cmp_pv.ui.dom);

				// Select first
				cmp_pv.ui.showPurpose(1);

				// Accept on scroll
				//window.addEventListener('scroll', cmp_pv.ui.acceptOnEvent, {passive: true, once: true});
			}
		},
		show: function(bool) {
			if (cmp_pv.ui.dom === null) {
				cmp_pv.ui.create(0);
			} else {
				cmp_pv.ui.dom.style.display = (!bool) ? 'none' : 'block';
			}
			return true;
		},
		showStep: function(step) {
			for (var i = 1; i < 3; i++) {
				document.getElementById('step' + i).style.display = (i === step) ? 'block' : 'none';
			}
		},
		showPurpose: function (purpose, arrow) {
			for (var i = 1; i <= 5; i++) {
				document.getElementById('purpose_' + i).className = (i === purpose) ? 'active' : '';
			}
			document.getElementById('vendors').className = 'vendors pid' + purpose;
			if (arrow === true) {
				var container = document.getElementById('purpose_container');
				if (container.className.indexOf('showPurposes') === -1) {
					container.className = 'container showPurposes';
				} else {
					container.className = 'container';
				}
			}
		},
		showPurposeDescription: function (purpose) {
			cmp_pv.ui.dom.addEventListener('click', function () {
				document.getElementById('purpose_' + purpose).children[1].style.display = 'none';
			}, true);
			document.getElementById('purpose_' + purpose).children[1].style.display = 'block';
		},
		showVendors: function(i) {
			var not = (i === 1) ? 0 : 1;
			document.getElementById('vendors_' + i).className = 'active';
			document.getElementById('vendors_list_' + i).style.display = 'block';
			document.getElementById('vendors_list_' + not).style.display = 'none';
			document.getElementById('vendors_' + not).className = '';
		},
		switchPurpose: function(purpose, checked) {
			cmp_pv.consentString.data.purposesAllowed[purpose] = checked;
			cmp_pv.consentString.dataPub.standardPurposesAllowed[purpose] = checked;
			var matches = document.querySelectorAll("#vendors .pid" + purpose + " input");
			for (var i = 0; i < matches.length; i++) {
				cmp_pv.consentString.data.bitField[matches[i].value] = checked;
				matches[i].checked = checked;
			}
		},
		switchAllPurpose: function (checked) {
			for (var i = 0; i < cmp_pv.consentString.data.purposesAllowed.length; i++) {
				cmp_pv.consentString.data.purposesAllowed[i] = checked;
			}
			for (i = 0; i < cmp_pv.consentString.dataPub.standardPurposesAllowed.length; i++) {
				cmp_pv.consentString.dataPub.standardPurposesAllowed[i] = checked;
			}
			var matches = document.querySelectorAll("#step2 input");
			for (i = 0; i < matches.length; i++) {
				cmp_pv.consentString.data.bitField[matches[i].value] = checked;
				matches[i].checked = checked;
			}
		},
		switchVendor: function(vendor, checked) {
			cmp_pv.consentString.data.bitField[vendor] = checked;
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
		sortVendors: function () {
			cmp_pv.globalVendorList.vendors = cmp_pv.globalVendorList.vendors.sort(function (a, b) {
				if (a.name.toLowerCase() < b.name.toLowerCase()) {
					return -1;
				} else {
					return 1;
				}
			});
		},
		/*acceptOnEvent: function () {
			window.removeEventListener('scroll', cmp_pv.ui.acceptOnEvent, {passive: true, once: true});
			cmp_pv.cookie.saveConsent(true);
		},*/
		// https://vendorlist.consensu.org/purposes-fr.json
		language: {
			'fr': {
				"purposes": {
					1: {
						"name": "Conservation et acc\u00e8s aux informations ",
						"description": "La conservation d\u2019informations ou l\u2019acc\u00e8s \u00e0 des informations d\u00e9j\u00e0 conserv\u00e9es sur votre appareil, par exemple des identifiants publicitaires, des identifiants de l\u2019appareil, des cookies et des technologies similaires."
					},
					2: {
						"name": "Personnalisation",
						"description": "Collecte et traitement d\u2019informations relatives \u00e0 votre utilisation de ce service afin de vous adresser ult\u00e9rieurement des publicit\u00e9s et/ou du contenu personnalis\u00e9s dans d\u2019autres contextes, par exemple sur d\u2019autres sites ou applications. En g\u00e9n\u00e9ral, le contenu du site ou de l\u2019application est utilis\u00e9 pour faire des d\u00e9ductions concernant vos int\u00e9r\u00eats, ce qui sera utile dans le cadre de s\u00e9lections ult\u00e9rieures de publicit\u00e9 et/ou de contenu."
					},
					3: {
						"name": "S\u00e9lection, diffusion et signalement de publicit\u00e9s",
						"description": "Collecte d\u2019informations qui sont en suite associ\u00e9es \u00e0 celles rassembl\u00e9es pr\u00e9c\u00e9demment, afin de s\u00e9lectionner et diffuser des publicit\u00e9s \u00e0 votre \u00e9gard, puis \u00e9valuer leur diffusion ainsi que leur efficacit\u00e9. Cela comprend : le fait d\u2019utiliser des informations collect\u00e9es pr\u00e9c\u00e9demment relativement \u00e0 vos int\u00e9r\u00eats afin de s\u00e9lectionner des publicit\u00e9s ; le traitement de donn\u00e9es indiquant quelles publicit\u00e9s ont \u00e9t\u00e9 affich\u00e9es et \u00e0 quelle fr\u00e9quence, \u00e0 quel moment et o\u00f9 elles ont \u00e9t\u00e9 affich\u00e9es ; et le fait de savoir si vous avez r\u00e9agi par rapport auxdites publicit\u00e9s, par exemple si vous avez cliqu\u00e9 dessus ou effectu\u00e9 un achat. Cela ne comprend pas la Personnalisation qui consiste en la collecte et le traitement d\u2019informations relatives \u00e0 votre utilisation de ce service afin de vous adresser ult\u00e9rieurement des publicit\u00e9s et/ou du contenu personnalis\u00e9s dans d\u2019autres contextes, par exemple sur des sites ou applications."
					},
					4: {
						"name": "S\u00e9lection, diffusion et signalement de contenu",
						"description": "La collecte d\u2019informations que l\u2019on associe \u00e0 celles rassembl\u00e9es pr\u00e9c\u00e9demment afin de s\u00e9lectionner et diffuser des contenus \u00e0 votre \u00e9gard, puis \u00e9valuer leur diffusion ainsi que leur efficacit\u00e9. Cela comprend : le fait d\u2019utiliser des informations collect\u00e9es pr\u00e9c\u00e9demment relativement \u00e0 vos int\u00e9r\u00eats afin de s\u00e9lectionner du contenu ; le traitement de donn\u00e9es indiquant quel contenu a \u00e9t\u00e9 affich\u00e9, \u00e0 quelle fr\u00e9quence, pendant combien de temps, \u00e0 quel moment et o\u00f9 il a \u00e9t\u00e9 affich\u00e9 ; et le fait de savoir si vous avez r\u00e9agi par rapport audit contenu, par exemple si vous cliqu\u00e9 dessus. Cela ne comprend pas la Personnalisation qui consiste en la collecte et le traitement d\u2019informations relatives \u00e0 votre utilisation de ce service afin de vous adresser, ult\u00e9rieurement du contenu et/ou des publicit\u00e9s personnalis\u00e9s dans d\u2019autres contextes, par exemple sur des sites ou applications."
					},
					5: {
						"name": "\u00c9valuation",
						"description": "La collecte d\u2019informations relatives \u00e0 votre utilisation du contenu et association desdites informations avec celles pr\u00e9c\u00e9demment collect\u00e9es afin d\u2019\u00e9valuer, de comprendre et de rendre compte de la fa\u00e7on dont vous utilisez le service. Cela ne comprend pas la Personnalisation, la collecte d\u2019informations relatives \u00e0 votre utilisation de ce service afin de vous adresser ult\u00e9rieurement du contenu et/ou des publicit\u00e9s personnalis\u00e9s dans d\u2019autres contextes, c\u2019est-\u00e0-dire sur d\u2019autres services, tels que des sites ou des applications."
					}
				}
			}
		}
	},

	/** Cookie **/
	cookie: {
		vendorCookieName: 'euconsent',
		publisherCookieName: 'eupubconsent',
		readCookie: function(name, cb) {
			var value = "; " + document.cookie;
			var parts = value.split("; " + name + "=");

			if (parts.length >= 2) {
				if (typeof cb === 'function') cb(parts.pop().split(';').shift());
				return parts.pop().split(';').shift();
			} else {
				if (typeof cb === 'function') cb('');
			}
		},
		writeCookie: function(name, value, maxAgeSeconds, path, domain) {
			var maxAge = maxAgeSeconds === null ? '' : ";max-age=" + maxAgeSeconds;
			var valDomain = domain === null ? '' : ';domain=' + domain;
			document.cookie = name + "=" + value + ";path=" + path + maxAge + valDomain;
			this.saveVerification(name);
		},
		readGlobalCookie: function(name, cb) {
			cmp_pv.portal.sendPortalCommand({
				command: 'readVendorConsent'
			}, function(data) {
				cb((typeof data === 'object') ? '' : data);
			});
		},
		writeGlobalCookie: function(name, value) {
			cmp_pv.portal.sendPortalCommand({
				command: 'writeVendorConsent',
				encodedValue: value
			}, function() {
				cmp_pv.cookie.saveVerification(name);
			});
		},
		loadVendorCookie: function(cb) {
			var fnct = (cmp_pv.conf.hasGlobalScope) ? 'readGlobalCookie' : 'readCookie';
			this[fnct](this.vendorCookieName, function(data) {
				cb(("undefined" !== typeof data) ? cmp_pv.consentString.decodeVendorConsentData(data) : false);
			})
		},
		loadPublisherCookie: function() {
			var data = this.readCookie(this.publisherCookieName);
			if ("undefined" !== typeof data) {
				return cmp_pv.consentString.decodePublisherConsentData(data);
			}
			return false;
		},
		writeVendorCookie: function() {
			var data = cmp_pv.consentString.generateVendorConsentString();
			var fnct = (cmp_pv.conf.hasGlobalScope) ? 'writeGlobalCookie' : 'writeCookie';
			this[fnct](this.vendorCookieName, data, 33696000, '/', cmp_pv.conf.cookieDomain);
		},
		writePublisherCookie: function() {
			var data = cmp_pv.consentString.generatePublisherConsentString();
			this.writeCookie(this.publisherCookieName, data, 33696000, '/', cmp_pv.conf.cookieDomain);
		},
		saveConsent: function(all) {
			// Maj dates
			cmp_pv.consentString.data.lastUpdated = new Date();
			cmp_pv.consentString.dataPub.lastUpdated = new Date();

			// Accepte tout
			if (all) {
				var i;
				for (i = 1; i <= cmp_pv.consentString.data.maxVendorId; i++) {
					cmp_pv.consentString.data.bitField[i] = true;
				}
				var maxStandard = Object.keys(cmp_pv.consentString.dataPub.standardPurposesAllowed).length;
				for (i = 1; i <= maxStandard; i++) {
					cmp_pv.ui.switchPurpose(i, true);
				}
			}

			// Save cookies
			this.writeVendorCookie();
			this.writePublisherCookie();

			// Hide UI
			cmp_pv.ui.show(false);

			// Process commands
			cmp_pv.cmpReady = true;
			cmp_pv.processCommandQueue();

			// Callback
			if (typeof cmp_pv.conf.consentCallback === 'function') cmp_pv.conf.consentCallback();
		},
		loadConsent: function(cb) {
			var resP = this.loadPublisherCookie();
			this.loadVendorCookie(function(resV) {
				cb(resV && resP);
			});
		},
		saveVerification: function(name) {
			try {
				localStorage.setItem(name, new Date().toString());
			} catch (e) {
			}
		},
		lastVerification: function(name) {
			try {
				var date = localStorage.getItem(name);
				return (date) ? Date.parse(date) : new Date();
			} catch (e) {
				return new Date();
			}
		}
	},

	/** Consent String */
	consentString: {
		const: {
			VERSION_BIT_OFFSET: 0,
			VERSION_BIT_SIZE: 6,
			CMP_ID: 0,
			CMP_VERSION: 1,

			// Version 1
			vendor_1: [
				{name: 'version', type: 'int', numBits: 6, default: 1},
				{name: 'created', type: 'date', numBits: 36, default: new Date()},
				{name: 'lastUpdated', type: 'date', numBits: 36, default: new Date()},
				{
					name: 'cmpId', type: 'int', numBits: 12, default: function() {
						return cmp_pv.consentString.const.CMP_ID
					}
				},
				{
					name: 'cmpVersion', type: 'int', numBits: 12, default: function() {
						return cmp_pv.consentString.const.CMP_VERSION
					}
				},
				{name: 'consentScreen', type: 'int', numBits: 6, default: 1},
				{name: 'consentLanguage', type: '6bitchar', numBits: 12, default: 'FR'},
				{
					name: 'vendorListVersion', type: 'int', numBits: 12, default: function() {
						return cmp_pv.globalVendorList.vendorListVersion
					}
				},
				{
					name: 'purposesAllowed', type: 'bits', numBits: 24, default: function() {
						return cmp_pv.consentString.defaultBits(false, this.numBits)
					}
				},
				{
					name: 'maxVendorId', type: 'int', numBits: 16,
					default: function() {
						var maxVendorId = 1;
						for (var i = 0; i < cmp_pv.globalVendorList.vendors.length; i++) {
							if (cmp_pv.globalVendorList.vendors[i].id > maxVendorId) maxVendorId = cmp_pv.globalVendorList.vendors[i].id;
						}
						return maxVendorId;
					}
				},
				{name: 'encodingType', type: 'int', numBits: 1, default: 0},
				{
					name: 'bitField', type: 'bits', numBits: function(obj) {
						return obj.maxVendorId;
					}, validator: function(obj) {
						return obj.encodingType === 0;
					}, default: function(obj) {
						return cmp_pv.consentString.defaultBits(false, obj.maxVendorId);
					}
				},
				{
					name: 'defaultConsent', type: 'bool', numBits: 1, validator: function(obj) {
						return obj.encodingType === 1;
					}, default: false
				},
				{
					name: 'numEntries', type: 'int', numBits: 12, validator: function(obj) {
						return obj.encodingType === 1;
					}, default: 0
				},
				{
					name: 'rangeEntries', type: 'list', validator: function(obj) {
						return obj.encodingType === 1;
					}, listCount: function(obj) {
						return obj.numEntries;
					},
					fields: [
						{name: 'isRange', type: 'bool', numBits: 1},
						{name: 'startVendorId', type: 'int', numBits: 16},
						{
							name: 'endVendorId', type: 'int', numBits: 16, validator: function(obj) {
								return obj.isRange
							}
						}
					]
				}
			],
			metadata_1: [
				{name: 'version', type: 'int', numBits: 6},
				{name: 'created', type: 'date', numBits: 36},
				{name: 'lastUpdated', type: 'date', numBits: 36},
				{name: 'cmpId', type: 'int', numBits: 12},
				{name: 'cmpVersion', type: 'int', numBits: 12},
				{name: 'consentScreen', type: 'int', numBits: 6},
				{name: 'vendorListVersion', type: 'int', numBits: 12},
				{name: 'purposesAllowed', type: 'bits', numBits: 24}
			],
			publisher_1: [
				{name: 'version', type: 'int', numBits: 6, default: 1},
				{name: 'created', type: 'date', numBits: 36, default: new Date()},
				{name: 'lastUpdated', type: 'date', numBits: 36, default: new Date()},
				{
					name: 'cmpId', type: 'int', numBits: 12, default: function() {
						return cmp_pv.consentString.const.CMP_ID
					}
				},
				{
					name: 'cmpVersion', type: 'int', numBits: 12, default: function() {
						return cmp_pv.consentString.const.CMP_VERSION
					}
				},
				{name: 'consentScreen', type: 'int', numBits: 6, default: 1},
				{name: 'consentLanguage', type: '6bitchar', numBits: 12, default: 'FR'},
				{
					name: 'vendorListVersion', type: 'int', numBits: 12, default: function() {
						return cmp_pv.globalVendorList.vendorListVersion
					}
				},
				{name: 'publisherPurposesVersion', type: 'int', numBits: 12, default: 1},
				{
					name: 'standardPurposesAllowed', type: 'bits', numBits: 24, default: function() {
						return cmp_pv.consentString.defaultBits(false, this.numBits)
					}
				},
				{name: 'numberCustomPurposes', type: 'int', numBits: 6, default: 0},
				{
					name: 'customPurposesBitField', type: 'bits', numBits: function(obj) {
						return obj.numberCustomPurposes;
					}, default: function(obj) {
						return cmp_pv.consentString.defaultBits(false, obj.numberCustomPurposes)
					}
				}
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
			numEntries: null,
			rangeEntries: []
		},

		dataPub: {
			bitString: "",
			version: 1,
			created: null,
			lastUpdated: null,
			cmpId: null,
			cmpVersion: null,
			consentScreen: null,
			consentLanguage: null,
			vendorListVersion: null,
			publisherPurposesVersion: null,
			standardPurposesAllowed: [],
			numberCustomPurposes: null,
			customPurposesBitField: []
		},

		decodeVendorConsentData: function(cookieValue) {
			var res = this.decodeCookieData('vendor_', 'data', cookieValue);
			if (res && this.data.encodingType === 1) {
				var range, i, y;
				var consent = !this.data.defaultConsent;
				// Initialize bitField
				this.data.bitField = cmp_pv.consentString.defaultBits(this.data.defaultConsent, this.data.maxVendorId);
				// Assign range value
				for (i = 0; i < this.data.rangeEntries.length; i++) {
					range = this.data.rangeEntries[i];
					if (range.isRange) {
						for (y = range.startVendorId; y <= range.endVendorId; y++) {
							this.data.bitField[y] = consent;
						}
					} else {
						this.data.bitField[range.startVendorId] = consent;
					}
				}
				return true;
			}
			return res;
		},
		decodePublisherConsentData: function(cookieValue) {
			return this.decodeCookieData('publisher_', 'dataPub', cookieValue);
		},
		decodeCookieData: function(type, varname, cookieValue) {
			if (cookieValue === '') return false;
			this[varname].bitString = this.decodeBase64UrlSafe(cookieValue);
			var cookieVersion = this.decodeBitsToInt(this[varname], this.const.VERSION_BIT_OFFSET, this.const.VERSION_BIT_SIZE);
			if (typeof cookieVersion !== 'number') {
				console.error('Could not find cookieVersion to decode');
				return false;
			}
			if (typeof this.const[type + cookieVersion] === 'undefined') {
				console.error('Could not find definition for cookieVersion ' + cookieVersion);
				return false;
			}

			this[varname] = this.decodeConsentData(this.const[type + cookieVersion], this[varname], 0).obj;
			return true;
		},
		generateVendorConsentMetadata: function() {
			var inputBits = this.encodeConsentData(this.const['metadata_' + this.data.version], this.data);
			return this.encodeBase64UrlSafe(inputBits);
		},
		generateVendorConsentString: function() {
			this.data = Object.assign(this.data, this.convertVendorsToRanges());
			var inputBitsRange = this.encodeConsentData(this.const['vendor_' + this.data.version], Object.assign(this.data, {encodingType: 1}));
			var inputBits = this.encodeConsentData(this.const['vendor_' + this.data.version], Object.assign(this.data, {encodingType: 0}));
			return this.encodeBase64UrlSafe((inputBits.length > inputBitsRange.length) ? inputBitsRange : inputBits);
		},
		generatePublisherConsentString: function() {
			var inputBits = this.encodeConsentData(this.const['publisher_' + this.dataPub.version], this.dataPub);
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
		decodeBitsToInt: function(datas, start, length) {
			return parseInt(datas.bitString.substr(start, length), 2);
		},
		decodeBitsToDate: function(datas, start, length) {
			return new Date(this.decodeBitsToInt(datas, start, length) * 100);
		},
		decodeBitsToBool: function(datas, start) {
			return parseInt(datas.bitString.substr(start, 1), 2) === 1;
		},
		decode6BitCharacters: function(datas, start, length) {
			var decoded = '';
			var decodeStart = start;
			while (decodeStart < start + length) {
				decoded += String.fromCharCode(this.const.SIX_BIT_ASCII_OFFSET + this.decodeBitsToInt(datas, decodeStart, 6));
				decodeStart += 6;
			}
			return decoded;
		},
		decodeBase64UrlSafe: function(value) {
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
		decodeConsentData: function(fields, datas, start) {
			var obj = {};
			var i, z, y, field;
			var totalLength = 0;
			for (i = 0; i < fields.length; i++) {
				field = fields[i];
				if ('function' === typeof field.validator && !field.validator(obj)) continue;
				var length = ('function' === typeof field.numBits) ? field.numBits(obj) : field.numBits;
				switch (field.type) {
					case 'int':
						obj[field.name] = this.decodeBitsToInt(datas, start, length);
						break;
					case 'date':
						obj[field.name] = this.decodeBitsToDate(datas, start, length);
						break;
					case '6bitchar':
						obj[field.name] = this.decode6BitCharacters(datas, start, length);
						break;
					case 'bool':
						obj[field.name] = this.decodeBitsToBool(datas, start);
						break;
					case 'bits':
						z = 1;
						obj[field.name] = {};
						for (y = start; y < start + length; y++) {
							obj[field.name][z] = this.decodeBitsToBool(datas, y);
							z++;
						}
						break;
					case 'list':
						var listCount = field.listCount(obj);
						length = 0;
						obj[field.name] = [];
						for (z = 0; z < listCount; z++) {
							var decodedObj = this.decodeConsentData(field.fields, datas, start + length);
							length += decodedObj.length;
							obj[field.name].push(decodedObj.obj);
						}
						break;
					default:
						console.warn("Cookie definition field found without encoder or type: %s", field.name);
				}
				totalLength += length;
				start += length;
			}

			return {obj: obj, length: totalLength};
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
			var encoded = typeof string !== 'string' ? '' : string.split('').map(function(char) {
				var int = Math.max(0, char.toUpperCase().charCodeAt(0) - cmp_pv.consentString.const.SIX_BIT_ASCII_OFFSET);
				return cmp_pv.consentString.encodeIntToBits(int > 25 ? 0 : int, 6);
			}).join('');
			return this.padRight(encoded, numBits).substr(0, numBits);
		},
		encodeBase64UrlSafe: function(binaryValue) {
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
		encodeConsentData: function(fields, datas) {
			var inputBits = "";
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i];
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
			return inputBits;
		},
		defaultBits: function(val, numBits) {
			var obj = {};
			for (var i = 1; i <= numBits; i++) {
				obj[i] = val;
			}
			return obj;
		},
		generateConsentData: function(fields) {
			var obj = {};
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i];
				obj[field.name] = ('function' === typeof field.default) ? field.default(obj) : field.default;
			}
			return obj;
		},
		generateVendorConsentData: function() {
			return this.generateConsentData(this.const['vendor_' + this.data.version]);
		},
		generatePublisherConsentData: function() {
			return this.generateConsentData(this.const['publisher_' + this.dataPub.version]);
		},
		convertVendorsToRanges: function() {
			var range = [];
			var rangeType = (this.data.bitField[1] === 1);
			var ranges = {false: [], true: []};
			for (var id = 1; id <= this.data.maxVendorId; id++) {
				if (this.data.bitField[id] === rangeType) {
					range.push(id);
				}
				// Range has ended or at the end of vendors list => add range entry
				if (this.data.bitField[id] !== rangeType || id === this.data.maxVendorId) {
					if (range.length) {
						var startVendorId = range.shift();
						var endVendorId = range.pop();
						range = [];
						ranges[rangeType].push({
							isRange: typeof endVendorId === 'number',
							startVendorId: startVendorId,
							endVendorId: endVendorId
						})
					}
				}
			}
			rangeType = (ranges[true].length < ranges[false].length);
			if (ranges[rangeType].length === 0) rangeType = (this.data.bitField[1] === 1);
			return {defaultConsent: !rangeType, rangeEntries: ranges[rangeType], numEntries: ranges[rangeType].length};
		}
	},

	/** Portal **/
	portal: {
		globalVendorPortal: false,
		portalQueue: {},
		portalCallCount: 0,
		openGlobalVendorPortal: function(cb) {
			// Only ever create a single iframe
			if (!this.globalVendorPortal) {
				var url = cmp_pv.conf.globalConsentLocation;
				var iframe = document.createElement('iframe');
				iframe.setAttribute('style', 'width:1px;height:1px;position:absolute;left:-99px;top:-99px;');
				iframe.setAttribute('src', url);
				document.body.appendChild(iframe);

				var portalTimeout = setTimeout(function() {
					cb(new Error("Communication could not be established with the vendor domain within 5000 milliseconds"));
				}, 5000);

				// Add listener for messages from iframe
				window.addEventListener('message', function(event) {
					// Only look at messages with the vendorConsent property
					var data = event.data.vendorConsent;
					if (data) {
						// The iframe has loaded
						if (data.command === 'isLoaded' && portalTimeout) {
							clearTimeout(portalTimeout);
							portalTimeout = undefined;
							cmp_pv.portal.globalVendorPortal = iframe;
							cb(iframe);
						}
						else {
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
		sendPortalCommand: function(message, cb) {
			// Increment counter to use as unique callId
			var callId = "vp:" + (++this.portalCallCount);

			// Make sure iframe is loaded
			this.openGlobalVendorPortal(function(iframe) {

				var timeout = setTimeout(function() {
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
	_fetchGlobalVendorList: function(callback) {
		cmp_pv._fetch(cmp_pv.conf.urlVendorList, function(res) {
			if (res.status === 200) {
				cmp_pv.globalVendorList = JSON.parse(res.responseText);
				cmp_pv.ui.sortVendors();
			} else {
				console.error("Can't fetch vendorlist: %d (%s)", res.status, res.statusText);
			}
			callback();
		});
	},

	_fetchPubVendorList: function(callback) {
		cmp_pv._fetch("/.well-known/pubvendors.json", function(res) {
			if (res.status === 200) {
				cmp_pv.pubvendor = JSON.parse(res.responseText);
			} else {
				console.error("Can't fetch pubvendors: %d (%s)", res.status, res.statusText);
			}
			callback();
		});
	},

	_fetch: function(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (this.readyState === XMLHttpRequest.DONE) {
				callback(this);
			}
		};
		xhr.open("GET", url, true);
		xhr.send();
	}
};

window.__cmp = cmp_pv.processCommand;
cmp_pv.processCommandQueue();
