/**
 * == CMP ==
 **/
var cmp_pv = {
    /** Interface **/
    isLoaded: false,
    cmpReady: false,
    commandQueue: window.__tcfapi.a || [],
    processCommand: function (command, version, callback, parameter) {
        if (typeof cmp_pv.commands[command] !== 'function') {
            console.error("Invalid CMP command %s,", command);
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
        publisherName: 'ParuVendu.fr',
        urlVendorList: 'https://vendorlist.consensu.org/v2/vendor-list.json',
        urlCookiesUsage: 'https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#cookies',
        dayCheckInterval: 30,
        globalConsentLocation: 'https://paruvendu.mgr.consensu.org/portal.html',
        uiColor: '#EE1C24'
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
                            if (cmp_pv.globalVendorList.vendorListVersion !== cmp_pv.consentString.data.vendorListVersion) {
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
                displayStatus: (cmp_pv.ui.dom.style.display === 'block') ? 'visible' : 'hidden',
                apiVersion: "2.0",
                cmpVersion: cmp_pv.consentString.data.cmpVersion,
                cmpId: cmp_pv.consentString.const.CMP_ID,
                gvlVersion: cmp_pv.globalVendorList.gvlSpecificationVersion,
                tcfPolicyVersion: 2
            });
        },

        showConsentUi: function (_, callback) {
            callback(cmp_pv.ui.show(true));
        },

        getTCData: function (vendorIds, callback) {
            var vendorList;
            if (vendorIds && vendorIds.length) {
                vendorList = cmp_pv.consentString.defaultBits(false, cmp_pv.consentString.data.vendorConsent.maxVendorId);
                for (var i = 0; i < vendorIds.length; i++) {
                    vendorList[vendorIds[i]] = cmp_pv.consentString.data.vendorConsent.bitField[vendorIds[i]];
                }
            } else {
                vendorList = cmp_pv.consentString.data.vendorConsent.bitField;
            }

            var consent = {
                tcString: cmp_pv.consentString.generateVendorConsentString(),
                tcfPolicyVersion: 2,
                cmpId: cmp_pv.consentString.const.CMP_ID,
                cmpVersion: cmp_pv.consentString.data.cmpVersion,

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
                eventStatus: 'string',

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
                    discloseVendors: {

                        /**
                         * true - Vendor has been disclosed to the user
                         * false - Vendor has been disclosed to the user
                         */
                        //'[vendor id]': Boolean
                    }
                },
                purpose: {
                    consents: cmp_pv.consentString.data.purposesConsent,
                    legitimateInterests: cmp_pv.consentString.data.purposesLITransparency
                },
                vendor: {
                    consents: vendorList,
                    legitimateInterests: cmp_pv.consentString.data.vendorLegitimateInterest.bitField
                },
                speicalFeatureOptins: cmp_pv.consentString.data.specialFeatureOptIns,
                publisher: {
                    consents: {

                        /**
                         * true - Consent
                         * false - No Consent
                         */
                        // '[purpose id]': Boolean
                    },
                    legitimateInterests: {

                        /**
                         * true - Legitimate Interest Established
                         * false - No Legitimate Interest Established
                         */
                        // '[purpose id]': Boolean
                    },
                    customPurpose: {
                        consents: {

                            /**
                             * true - Consent
                             * false - No Consent
                             */
                            // '[purpose id]': Boolean
                        },
                        legitimateInterests: {

                            /**
                             * true - Legitimate Interest Established
                             * false - No Legitimate Interest Established
                             */
                            // '[purpose id]': Boolean
                        }
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

            callback(consent, true)
        },

        addEventListener: function (_, callback) {
            cmp_pv.event.listeners.push(callback);
        },

        removeEventListener: function (_, callback) {
            delete cmp_pv.event.listeners[cmp_pv.event.listeners.indexOf(callback)];
        }
    },

    /** Events **/
    event: {
        listeners: [],
        send: function (eventStatus) {
            console.info('Listeners fired : ' + eventStatus);
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

                    if (typeof cmp_pv.consentString.data.created === 'undefined') cmp_pv.consentString.data = cmp_pv.consentString.generateVendorConsentData();

                    // Create UI
                    cmp_pv.ui.dom = document.createElement('div');

                    var css = '';
                    css += '.cmpcontainer {position: fixed; top:0; bottom: 0; left: 0; right: 0; z-index: 100000; background: rgba(33,41,52,.66);}';
                    css += '#CMP_PV {background: #fff; padding: 15px;font-family:Tahoma, Geneva, sans-serif; font-size: 14px;box-shadow: 0 0 5px #000000a1;box-sizing: border-box;max-width: 1030px;margin: auto;min-width: 320px;border-radius: 2px;margin-top: 50vh;transform: translateY(-50%);}';
                    css += '#CMP_PV p{margin:0;}';
                    css += '#CMP_PV a{color:' + cmp_pv.conf.uiColor + '; text-decoration: underline; cursor: pointer;}';
                    css += '#CMP_PV a:hover{color:#D41920; text-decoration: none;}';
                    css += '#CMP_PV button{background-color: ' + cmp_pv.conf.uiColor + ';border: 2px solid ' + cmp_pv.conf.uiColor + ';font-size: 20px;font-weight: bold;color: #fff;cursor: pointer;padding:5px; transition: background 300ms;}';
                    css += '#CMP_PV button:hover{background-color: #FFF;color:' + cmp_pv.conf.uiColor + ';}';
                    css += '#CMP_PV button.inverse{background-color: #FFF;color:' + cmp_pv.conf.uiColor + ';}';
                    css += '#CMP_PV button.inverse:hover{background-color: ' + cmp_pv.conf.uiColor + ';color:#FFF;}';
                    css += '#CMP_PV .switch{position: relative;display: inline-block;width: 60px;height: 16px;cursor: pointer;}';
                    css += '#CMP_PV .switch input {display:none;}';
                    css += '#CMP_PV .slider{position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; -webkit-transition: .2s; transition: .2s;border-radius: 34px;height: 18px;}';
                    css += '#CMP_PV .slider:before{position: absolute;content: "";height: 24px;width: 24px;left: 0;bottom: -4px;background-color: white;-webkit-transition: .2s;transition: .2s;border-radius: 50%;border:1px solid #aaa}';
                    css += '#CMP_PV input:checked + .slider{background-color: #8BC34A;}';
                    css += '#CMP_PV input:focus + .slider{box-shadow: 0 0 1px #8BC34A;}';
                    css += '#CMP_PV input:checked + .slider:before {transform: translateX(34px);border-color:#7BAA44;}';
                    // css += '#CMP_PV #step1{max-width:770px;}';
                    css += '#CMP_PV #step1 .title{color: #111;font-weight: bold;text-align: center;font-size:32px;padding: 30px 10px 40px 10px;text-transform: uppercase;text-shadow: 0 1px 2px rgba(0, 0, 0, 0.39);}';
                    css += '#CMP_PV #step1 .buttons{margin:38px 0 10px 0;}';
                    css += '#CMP_PV #step1 .buttons > *{min-width: 210px; font-size: 16px;margin: 0 15px;text-align:center;}';
                    css += '#CMP_PV #step1 .buttons > a{line-height: 43px;}';
                    css += '#CMP_PV #step1 .desc>p{text-align:justify;font-size: 15px;padding: 0 15px;}';
                    css += '#CMP_PV .container{max-width: 1000px; margin-left:auto;margin-right:auto;display: flex;}';
                    css += '#CMP_PV .container:after{content:\'\';display:block;clear:both;}';
                    css += '#CMP_PV #step2 .desc{background: white;box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);padding: 10px;box-sizing: border-box;margin-top:10px;align-items: center;font-size:13px;}';
                    css += '#CMP_PV #step2 .desc div{display: flex;}';
                    css += '#CMP_PV #step2 .desc button{font-size: 16px;margin-left: 9px;white-space:nowrap;flex: 1;min-width:120px;}';
                    css += '#CMP_PV #step2 .desc.liste>div:first-child{display:none;}';
                    css += '#CMP_PV #step2 .desc:not(.liste)>div:last-child{display:none;}';
                    css += '#CMP_PV #step2 .desc.liste p{margin-left: 10px;font-weight: bold;font-size: 15px;}';
                    css += '#CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .purposes_desc {list-style:none; box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);padding: 0;width: 50%;margin:0;overflow: auto;height: 330px;}';
                    css += '#CMP_PV #step2 .container .purposes li{border-bottom: 1px solid rgba(0, 0, 0, 0.11);background: #3c3c3c; color: white;position:relative;}';
                    css += '#CMP_PV #step2 .container .purposes li:last-child{border-bottom: none;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4:first-child{border-left: 3px solid transparent;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4 .arrow{padding: 0 16px 0 0;width: 28px;text-align: right;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4 .title{padding: 14px 8px;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4 .arrow:after{content:\'\\276c\'; font-size: 25px;transition: all 0.5s;display: inline-block;height: 40px;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4{display:table;margin:0;font-weight:normal;cursor:pointer;height: 46px;width: 100%;box-sizing: border-box;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4:hover{background: #5f5f5f;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4>span{display: table-cell;vertical-align: middle;}';
                    css += '#CMP_PV #step2 .container .purposes li>h4>label{display: table-cell;border-top: 14px solid transparent;border-bottom: 14px solid transparent;}';
                    css += '#CMP_PV #step2 .container .purposes li.active>h4:first-child{border-left: 3px solid ' + cmp_pv.conf.uiColor + ';}';
                    css += '#CMP_PV #step2 .container .purposes li.active>h4 .arrow::after{transform: rotate(0.5turn);}';
                    css += '#CMP_PV #step2 .container .purposes_desc{background: white;position: relative;}';
                    css += '#CMP_PV #step2 .container .vendors li>h4>span{padding: 2px 5px;}';
                    css += '#CMP_PV #step2 .container .vendors li .switch{height: 0;width: 52px;}';
                    css += '#CMP_PV #step2 .container .vendors li .slider{height: 8px;}';
                    css += '#CMP_PV #step2 .container .vendors li .slider:before{height: 13px; width: 13px;bottom: -4px;}';
                    css += '#CMP_PV #step2 .container .vendors li>h4{height: 30px;}';
                    css += '#CMP_PV #step2 .container .vendors li>h4 .arrow::after{height: 20px;font-size:16px;}';
                    css += '#CMP_PV #step2 .container .purposes_desc>div{position: absolute;top: 30px;left: 0;right: 0;bottom: 0;overflow: auto;margin: 0;}';
                    css += '#CMP_PV #step2 .container .vendors.pid1 li:not(.pid1){display: none;}';
                    css += '#CMP_PV #step2 .container .vendors.pid2 li:not(.pid2){display: none;}';
                    css += '#CMP_PV #step2 .container .vendors.pid3 li:not(.pid3){display: none;}';
                    css += '#CMP_PV #step2 .container .vendors.pid4 li:not(.pid4){display: none;}';
                    css += '#CMP_PV #step2 .container .vendors.pid5 li:not(.pid5){display: none;}';
                    css += '#CMP_PV .buttons{display:flex;margin-top:10px;}';
                    css += '#CMP_PV .buttons>*{flex:1;}';
                    css += '#CMP_PV .buttons>a{line-height: 27px;}';
                    css += '#CMP_PV .buttons>a:nth-child(2){text-align:center;}';
                    css += '#CMP_PV #step2 .buttons button{font-size: 16px;padding: 5px 15px;}';
                    css += '#CMP_PV #step2 .purposes_desc>h4{display:block;margin:0;padding:5px 0;text-align: center;text-decoration:none;background:#515151;color:#ededed;border-bottom: 3px solid ' + cmp_pv.conf.uiColor + ';}';
                    css += '#CMP_PV #step2 .purposes_desc p{padding:10px;white-space: pre-wrap;}';
                    //Responsive
                    css += '@media screen and (min-width: 1024px) {';
                    css += '	#CMP_PV #step2 .container{width:1000px;}';
                    css += '}';
                    css += '@media screen and (max-width: 640px) {';
                    css += '	#CMP_PV{padding:0;width:100%;}';
                    css += '	#CMP_PV button{min-height: 46px;}';
                    css += '	#CMP_PV #step1{text-align: center;}';
                    css += '	#CMP_PV #step1 .desc{display:block;padding: 0 10px 10px 10px;}';
                    css += '    #CMP_PV .buttons{flex-direction: column;margin-bottom: 10px;}';
                    css += '    #CMP_PV #step1 .buttons{margin:20px 0 10px 0;}';
                    css += '    #CMP_PV #step1 .title{padding: 15px 10px 20px 10px;}';
                    css += '	#CMP_PV #step2 .desc>div{flex-flow: column;justify-content: space-evenly;}';
                    css += '	#CMP_PV #step2 .desc{align-items: initial;margin-top: 0;}';
                    css += '	#CMP_PV #step2 .buttons{margin: 10px;flex-wrap: wrap;flex-direction: row;}';
                    css += '	#CMP_PV #step2 #purposes, #CMP_PV #step2 #vendors{width:200%;max-width:initial;transition: transform .2s ease-in-out;}';
                    css += '	#CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .purposes_desc{width:46%;}';
                    css += '	#CMP_PV #step2 .container .purposes li{width:auto;}';
                    css += '	#CMP_PV #step2 .container .purposes li.active > h4 .arrow::after{transform: none;animation: bounce 0.6s ease-out;}';
                    css += '	#CMP_PV #step2 > .container.showPurposes .purposes li > h4 .arrow::after{visibility: hidden;}';
                    css += '	#CMP_PV #step2 > .container.showPurposes .purposes li.active > h4 .arrow::after{visibility: visible;transform: rotate(0.5turn);}';
                    css += '	#CMP_PV #step2 > .container.showPurposes {transform: translate3d(-42%, 0, 0);}';
                    css += '	#CMP_PV #step2 .desc>div>div{margin-top: 5px;}';
                    css += '	#CMP_PV #step2 .container .purposes li > h4 .title{padding: 8px;}';
                    css += '    #CMP_PV .buttons > a{flex:1 50%;line-height: 42px;}';
                    css += '    #CMP_PV #step1 .buttons > *, #CMP_PV #step2 .buttons{margin: 0;}';
                    css += '    #CMP_PV .buttons > a:first-child{padding-left: 10px;box-sizing: border-box;}';
                    css += '	@keyframes bounce{';
                    css += '		0% {transform:translate3d(0,0,0);}';
                    css += '		30% {transform:translate3d(5px,0,0);}';
                    css += '		60% {transform:translate3d(0px,0,0);}';
                    css += '		80% {transform:translate3d(2px,0,0);}';
                    css += '		100% {transform:translate3d(0,0,0);}';
                    css += '	}';
                    css += '}';
                    css += '@media screen and (max-height: 600px) {';
                    css += '    #CMP_PV #step2 .container .vendors, #CMP_PV #step2 .container .purposes, #CMP_PV #step2 .container .purposes_desc {height: 282px;}';
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

                    var html = '<div id="CMP_PV">';
                    html += '<div id="step1">';
                    html += '	<div class="title">Vos choix en matière de cookies</div>';
                    html += '	<div class="desc">';
                    html += '		<p>Nos partenaires et nous-mêmes utilisons différentes technologies, telles que les cookies, pour personnaliser les contenus et les publicités, proposer des fonctionnalités sur les réseaux sociaux et analyser le trafic. Merci de cliquer sur le bouton ci-dessous pour donner votre accord. Vous pouvez changer d\'avis et modifier vos choix à tout moment. Le fait de ne pas consentir ne vous empechera pas d\'accèder à notre service. <a onclick="cmp_pv.ui.showPurposes();">Afficher les utilisations prévues et les accepter ou les refuser</a>.</p>';
                    html += '	</div>';
                    html += '	<div class="container buttons">';
                    html += '	    <a onclick="cmp_pv.ui.toggleVendors()">Voir nos partenaires</a>';
                    // html += '		<button class="inverse" onclick="cmp_pv.ui.showPurposes();">Je personnalise ou Je refuse</button>';
                    html += '		<button onclick="cmp_pv.cookie.saveConsent(true);">J\'accepte</button>';
                    html += '	</div>';
                    html += '</div>';
                    html += '<div id="step2" style="display: none;">';
                    html += '	<div class="container desc">';
                    html += '	    <div>';
                    html += '		    <p>La collecte des données personnelles se fait en fonction des objectifs listés ci dessous. Vous pouvez configurer et choisir comment vous souhaitez que vos données personnelles soient utilisées de manière globale ou indépendemment pour chaque finalité et même pour chaque partenaire publicitaire. <a href="' + cmp_pv.conf.urlCookiesUsage + '" target="_blank">En savoir plus sur la gestion des cookies.</a></p>';
                    html += '		    <div>';
                    html += '			    <button onclick="cmp_pv.ui.switchAllPurpose(false);" class="inverse">Tout refuser</button>';
                    html += '			    <button onclick="cmp_pv.ui.switchAllPurpose(true);">Tout accepter</button>';
                    html += '		    </div>';
                    html += '		</div>';
                    html += '		<div><a href="javascript:cmp_pv.ui.toggleVendors();">&lsaquo; Retour</a><p></p></div>';
                    html += '	</div>';
                    html += '	<div class="container" id="purposes">';
                    html += '		<ul class="purposes">';
                    for (var i in cmp_pv.globalVendorList.purposes) {
                        if (!cmp_pv.globalVendorList.purposes.hasOwnProperty(i)) continue;
                        var purpose = cmp_pv.globalVendorList.purposes[i];
                        html += '		<li id="purpose_' + purpose.id + '">';
                        html += '			<h4><span class="title" onclick="cmp_pv.ui.showPurposeDescription(' + purpose.id + ');">' + purpose.name + '</span><label class="switch"><input type="checkbox" onchange="cmp_pv.ui.switchPurpose(' + purpose.id + ', this.checked);"' + ((cmp_pv.consentString.data.purposesConsent[purpose.id]) ? 'checked' : '') + '><span class="slider"></span></label><span class="arrow" onclick="cmp_pv.ui.showPurposeDescription(' + purpose.id + ', true);"></span></h4>';
                        html += '		</li>';
                    }
                    html += '		</ul>';
                    html += '		<div class="purposes_desc">';
                    html += '			<h4>Description</h4>';
                    html += '			<div><p id="purpose_desc"></p></div>';
                    html += '		</div>';
                    html += '	</div>';
                    html += '	<div class="container" id="vendors" style="display: none;">';
                    html += '		<ul class="purposes vendors">';
                    for (var y = 0; y < cmp_pv.globalVendorList.vendorsOrder.length; y++) {
                        var vendor = cmp_pv.globalVendorList.vendors[cmp_pv.globalVendorList.vendorsOrder[y]];
                        html += '			<li class="pid' + vendor.purposes.join(' pid') + '"><h4><span onclick="cmp_pv.ui.showVendorDescription(' + vendor.id + ',' + y + ');">' + vendor.name + '</span><label class="switch"><input type="checkbox" value="' + vendor.id + '" ' + ((cmp_pv.consentString.data.vendorConsent.bitField[vendor.id]) ? 'checked' : '') + ' onchange="cmp_pv.ui.switchVendor(' + vendor.id + ', this.checked);"><span class="slider"></span></label><span class="arrow" onclick="cmp_pv.ui.showVendorDescription(' + vendor.id + ',' + y + ', true);"></span></h4></li>';
                    }
                    html += '		</ul>';
                    html += '		<div class="purposes_desc">';
                    html += '			<h4>Description</h4>';
                    html += '			<div><p id="vendor_desc"></p></div>';
                    html += '		</div>';
                    html += '	</div>';
                    html += '	<div class="container buttons">';
                    html += '		<a href="javascript:cmp_pv.ui.showStep(1);">&lsaquo; Retour</a>';
                    html += '	    <a onclick="cmp_pv.ui.toggleVendors()" id="link_vendors">Voir nos partenaires</a>';
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

                    // Select first
                    cmp_pv.ui.showPurposeDescription(1);
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
        show: function (bool) {
            if (cmp_pv.ui.dom === null) {
                if (bool) cmp_pv.ui.create(0);
            } else {
                cmp_pv.ui.dom.style.display = (!bool) ? 'none' : 'block';

                // Fire cmpuishown event
                if (bool) cmp_pv.event.send('cmpuishown');
            }
            document.body.style.overflow = (!bool) ? '' : 'hidden';
            return true;
        },
        showPurposes: function () {
            this.showStep(2);
            document.getElementById('vendors').style.display = 'none';
            document.getElementById('link_vendors').innerText = 'Voir nos partenaires';
            document.getElementById('purposes').style.display = 'flex';
        },
        showStep: function (step) {
            for (var i = 1; i < 3; i++) {
                document.getElementById('step' + i).style.display = (i === step) ? 'block' : 'none';
            }
        },
        toggleVendors: function (purpose) {
            this.showStep(2);
            var el = document.getElementById('purposes');
            var el2 = document.getElementById('vendors');
            var step = document.getElementById('step2');
            el2.style.display = (el.style.display === 'none') ? 'none' : 'flex';
            if (typeof purpose != 'undefined') {
                el2.children[0].className = 'purposes vendors pid' + purpose;
                step.children[0].className += ' liste';
                // step.children[0].children[1].children[1].innerText = cmp_pv.ui.language['fr'].purposes[purpose].name;
                step.children[0].children[1].children[1].innerText = cmp_pv.globalVendorList.purposes[purpose].name;
                step.children[3].style.visibility = 'hidden';
                document.querySelector('#vendors ul li.pid' + purpose + ' span').onclick();
            } else {
                el2.children[0].className = 'purposes vendors';
                step.children[0].className = step.children[0].className.replace(' liste', '');
                step.children[3].style.visibility = 'visible';
            }
            document.getElementById('link_vendors').innerText = (el.style.display === 'none') ? 'Voir nos partenaires' : 'Voir les utilisations';
            el.style.display = (el.style.display === 'none') ? 'flex' : 'none';
        },
        showPurposeDescription: function (purpose, arrow) {
            var active = document.querySelector('.purposes li.active');
            if (active != null) active.className = '';
            document.getElementById('purpose_' + purpose).className = 'active';
            // document.getElementById('purpose_desc').innerHTML = "<p>" + cmp_pv.ui.language['fr'].purposes[purpose].description + "</p><a onclick='cmp_pv.ui.toggleVendors(" + purpose + ")'>Voir la liste</a>";
            document.getElementById('purpose_desc').innerHTML = "<p>" + cmp_pv.globalVendorList.purposes[purpose].description + "</p><p>" + cmp_pv.globalVendorList.purposes[purpose].descriptionLegal + "</p><a onclick='cmp_pv.ui.toggleVendors(" + purpose + ")'>Voir la liste</a>";
            if (arrow === true) {
                this.arrow('purposes');
            }
        },
        showVendorDescription: function (id, i, arrow) {
            var active = document.querySelector('.vendors li.active');
            if (active != null) active.className = active.className.replace(' active', '');
            document.querySelector('.vendors li:nth-of-type(' + (i + 1) + ')').className += ' active';
            var vendor = cmp_pv.globalVendorList.vendors[id];
            if (typeof vendor == 'undefined') return;
            var html = '<h2>' + vendor.name + '</h2><a href="' + vendor.policyUrl + '" target="_blank">Politique de confidentialité</a><br/>';
            var y = 0;
            var fields = ['purposes', 'legIntPurposes', 'features', 'specialFeatures'];
            for (i in fields) {
                var field = fields[i];
                if (!vendor.hasOwnProperty(field)) continue;
                if (vendor[field].length > 0) {
                    if (field === 'purposes') {
                        html += '<h3>Traitements de données basés sur le consentement :</h3>';
                    } else if (field === 'legIntPurposes') {
                        html += '<h3>Traitement de données basés sur l\'intérêt légitime :</h3>';
                    } else if (field === 'features') {
                        html += '<h3>Traitements de données supplémentaires: :</h3>';
                    } else if (field === 'specialFeatures') {
                        html += '<h3>Traitements de données supplémentaires: :</h3>';
                    }
                    html += '<ul>';
                    for (y = 0; y < vendor[field].length; y++) {
                        // html += '<li>' + cmp_pv.ui.language['fr'].purposes[vendor.purposeIds[y]].name + '</li>';
                        html += '<li>' + cmp_pv.globalVendorList.purposes[vendor[field][y]].name + '</li>';
                    }
                    html += '</ul>';
                }
            }
            document.getElementById('vendor_desc').innerHTML = html;
            if (arrow === true) {
                this.arrow('vendors');
            }
        },
        switchPurpose: function (purpose, checked) {
            cmp_pv.consentString.data.purposesConsent[purpose] = checked;
            var matches = document.querySelectorAll("#vendors .pid" + purpose + " input");
            for (var i = 0; i < matches.length; i++) {
                cmp_pv.consentString.data.vendorConsent.bitField[matches[i].value] = checked;
                matches[i].checked = checked;
            }
        },
        switchAllPurpose: function (checked) {
            cmp_pv.cookie.saveConsent(checked);
        },
        switchVendor: function (vendor, checked) {
            cmp_pv.consentString.data.vendorConsent.bitField[vendor] = checked;
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
        /*acceptOnEvent: function () {
            window.removeEventListener('scroll', cmp_pv.ui.acceptOnEvent, {passive: true, once: true});
            cmp_pv.cookie.saveConsent(true);
        },*/
        // https://vendorlist.consensu.org/purposes-fr.json
        language: {
            'fr': {
                "purposes": {},
                "features": {}
            }
        }
    },

    /** Cookie **/
    cookie: {
        vendorCookieName: 'euconsent-v2',
        readCookie: function (name, cb) {
            var value = "; " + document.cookie;
            var parts = value.split("; " + name + "=");

            if (parts.length >= 2) {
                if (typeof cb === 'function') cb(parts.pop().split(';').shift());
                return parts.pop().split(';').shift();
            } else {
                if (typeof cb === 'function') cb('');
            }
        },
        writeCookie: function (name, value, maxAgeSeconds, path, domain) {
            var maxAge = maxAgeSeconds === null ? '' : ";max-age=" + maxAgeSeconds;
            var valDomain = domain === null ? '' : ';domain=' + domain;
            document.cookie = name + "=" + value + ";path=" + path + maxAge + valDomain;
            this.saveVerification(name);
        },
        readGlobalCookie: function (name, cb) {
            cmp_pv.portal.sendPortalCommand({
                command: 'readVendorConsent'
            }, function (data) {
                cb((typeof data === 'object') ? '' : data);
            });
        },
        writeGlobalCookie: function (name, value) {
            cmp_pv.portal.sendPortalCommand({
                command: 'writeVendorConsent',
                encodedValue: value
            }, function () {
                cmp_pv.cookie.saveVerification(name);
            });
        },
        loadVendorCookie: function (cb) {
            var fnct = (cmp_pv.conf.hasGlobalScope) ? 'readGlobalCookie' : 'readCookie';
            this[fnct](this.vendorCookieName, function (data) {
                cb(("undefined" !== typeof data) ? cmp_pv.consentString.decodeVendorConsentData(data) : false);
            })
        },
        writeVendorCookie: function () {
            var data = cmp_pv.consentString.generateVendorConsentString();
            var fnct = (cmp_pv.conf.hasGlobalScope) ? 'writeGlobalCookie' : 'writeCookie';
            this[fnct](this.vendorCookieName, data, 33696000, '/', cmp_pv.conf.cookieDomain);
        },
        saveConsent: function (all) {
            // Maj dates
            cmp_pv.consentString.data.lastUpdated = new Date();
            cmp_pv.consentString.data.cmpId = cmp_pv.consentString.const.CMP_ID;

            // Accepte tout
            if (typeof all != 'undefined') {
                var i;
                for (i = 1; i <= cmp_pv.consentString.data.vendorConsent.maxVendorId; i++) {
                    cmp_pv.consentString.data.vendorConsent.bitField[i] = all;
                }
                for (i in cmp_pv.consentString.data.purposesConsent) {
                    if (cmp_pv.consentString.data.purposesConsent.hasOwnProperty(i)) {
                        cmp_pv.consentString.data.purposesConsent[i] = all;
                    }
                }
                var matches = document.querySelectorAll("#step2 input");
                for (i = 0; i < matches.length; i++) {
                    matches[i].checked = all;
                }
            }

            // Save cookies
            this.writeVendorCookie();

            // Hide UI
            cmp_pv.ui.show(false);

            // Process commands
            cmp_pv.cmpReady = true;
            cmp_pv.processCommandQueue();

            // Fire useractioncomplete event
            cmp_pv.event.send('useractioncomplete');
        },
        loadConsent: function (cb) {
            this.loadVendorCookie(function (resV) {
                if (cmp_pv.consentString.data.cmpId === 0) resV = false;
                cb(resV);
            });
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
        }
    },

    /** Consent String */
    consentString: {
        const: {
            VERSION_BIT_OFFSET: 0,
            VERSION_BIT_SIZE: 6,
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
                        return cmp_pv.consentString.defaultBits(true, this.numBits)
                    }
                },
                {name: 'purposeOneTreatment', type: 'int', numBits: 1, default: 0},
                {name: 'publisherCC', type: '6bitchar', numBits: 12, default: 'FR'},
                {
                    name: ['vendorConsent', 'vendorLegitimateInterest'],
                    fields: function (name) {
                        if (name === 'vendorLegitimateInterest') {
                            cmp_pv.consentString.const._rangeVendor[2].default = function (obj) {
                                return cmp_pv.consentString.defaultBits(true, obj.maxVendorId);
                            }
                        } else {
                            cmp_pv.consentString.const._rangeVendor[2].default = function (obj) {
                                return cmp_pv.consentString.defaultBits(false, obj.maxVendorId);
                            }
                        }
                        return cmp_pv.consentString.const._rangeVendor;
                    }
                },
                {name: 'numPubRestrictions', type: 'int', numBits: 12, default: 0}
            ],
            disclosedVendors: [ //OOB
                {name: 'segmentType', type: 'int', numBits: 3, default: 1},
                {
                    name: ['disclosedVendors'],
                    fields: this._rangeVendor
                }
            ],
            allowedVendors: [ //OOB
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
                        return cmp_pv.consentString.defaultBits(false, this.numBits)
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

        decodeVendorConsentData: function (cookieValue) {
            var res = this.decodeCookieData(cookieValue);
            if (res) {
                var names = ['vendorConsent', 'vendorLegitimateInterest'];
                for (var z = 0; z < names.length; z++) {
                    var name = names[z];
                    if (this.data[name].isRangeEncoding === 1) {
                        var range, i, y;
                        // Initialize bitField
                        this.data[name].bitField = cmp_pv.consentString.defaultBits(false, this.data[name].maxVendorId);
                        // Assign range value
                        for (i = 0; i < this.data[name].rangeEntries.length; i++) {
                            range = this.data[name].rangeEntries[i];
                            if (range.isARange) {
                                for (y = range.startOrOnlyVendorId; y <= range.endVendorId; y++) {
                                    this.data[name].bitField[y] = true;
                                }
                            } else {
                                this.data[name].bitField[range.startOrOnlyVendorId] = true;
                            }
                        }
                    }
                }
            }
            return res;
        },
        decodeCookieData: function (cookieValue) {
            if (cookieValue === '') return false;
            this.data.bitString = this.decodeBase64UrlSafe(cookieValue);
            var cookieVersion = this.decodeBitsToInt(this.data, this.const.VERSION_BIT_OFFSET, this.const.VERSION_BIT_SIZE);
            if (typeof cookieVersion !== 'number') {
                console.error('Could not find cookieVersion to decode');
                return false;
            }

            this.data = this.decodeConsentData(this.const.coreString, this.data, 0).obj;
            return true;
        },
        generateVendorConsentString: function () {
            var names = ['vendorConsent', 'vendorLegitimateInterest'];
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                this.data[name] = Object.assign(this.data[name], this.convertVendorsToRanges(name));
                // Range test
                var inputBitsRange = this.encodeConsentData(this.const._rangeVendor, Object.assign(this.data[name], {isRangeEncoding: 1}));
                var inputBits = this.encodeConsentData(this.const._rangeVendor, Object.assign(this.data[name], {isRangeEncoding: 0}));
                this.data[name].isRangeEncoding = (inputBits.length > inputBitsRange.length) ? 1 : 0;
            }

            inputBits = this.encodeConsentData(this.const.coreString, this.data);
            return this.encodeBase64UrlSafe(inputBits);
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
        decodeBitsToInt: function (datas, start, length) {
            return parseInt(datas.bitString.substr(start, length), 2);
        },
        decodeBitsToDate: function (datas, start, length) {
            return new Date(this.decodeBitsToInt(datas, start, length) * 100);
        },
        decodeBitsToBool: function (datas, start) {
            return parseInt(datas.bitString.substr(start, 1), 2) === 1;
        },
        decode6BitCharacters: function (datas, start, length) {
            var decoded = '';
            var decodeStart = start;
            while (decodeStart < start + length) {
                decoded += String.fromCharCode(this.const.SIX_BIT_ASCII_OFFSET + this.decodeBitsToInt(datas, decodeStart, 6));
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
        decodeConsentData: function (fields, datas, start) {
            var obj = {};
            var i, z, y, field, length;
            var totalLength = 0;
            for (i = 0; i < fields.length; i++) {
                field = fields[i];
                if (Array.isArray(field.name)) {
                    length = 0;
                    for (y = 0; y < field.name.length; y++) {
                        decodedObj = this.decodeConsentData(field.fields(), datas, start);
                        obj[field.name[y]] = decodedObj.obj;
                        length += decodedObj.length;
                    }
                } else {
                    if ('function' === typeof field.validator && !field.validator(obj)) continue;
                    length = ('function' === typeof field.numBits) ? field.numBits(obj) : field.numBits;
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
                }
                totalLength += length;
                start += length;
            }

            return {obj: obj, length: totalLength};
        },
        encodeIntToBits: function (number, numBits) {
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
        generateConsentData: function (fields) {
            var obj = {};
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                if (Array.isArray(field.name)) {
                    for (var y = 0; y < field.name.length; y++) {
                        obj[field.name[y]] = this.generateConsentData(field.fields(field.name[y]));
                    }
                } else {
                    obj[field.name] = ('function' === typeof field.default) ? field.default(obj) : field.default;
                }
            }
            return obj;
        },
        generateVendorConsentData: function () {
            return this.generateConsentData(this.const.coreString);
        },
        convertVendorsToRanges: function (name) {
            var range = [];
            var rangeType = true;
            var ranges = {false: [], true: []};
            for (var id = 1; id <= this.data[name].maxVendorId; id++) {
                if (this.data[name].bitField[id] === rangeType) {
                    range.push(id);
                }
                // Range has ended or at the end of vendors list => add range entry
                if (this.data[name].bitField[id] !== rangeType || id === this.data[name].maxVendorId) {
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
        cmp_pv._fetch(cmp_pv.conf.urlVendorList, function (res) {
            try {
                if (res.status === 200) {
                    cmp_pv.globalVendorList = JSON.parse(res.responseText);
                    cmp_pv.ui.sortVendors();
                } else {
                    console.error("Can't fetch vendorlist: %d (%s)", res.status, res.statusText);
                }
            } catch (e) {
            }
            callback();
        });
    },

    _fetchPubVendorList: function (callback) {
        cmp_pv._fetch("/.well-known/pubvendors.json", function (res) {
            try {
                if (res.status === 200) {
                    cmp_pv.pubvendor = JSON.parse(res.responseText);
                } else {
                    console.error("Can't fetch pubvendors: %d (%s)", res.status, res.statusText);
                }
            } catch (e) {
            }
            callback();
        });
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
