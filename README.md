# cmp_pv
> ParuVendu.fr Consent Management Platform

Démo : https://ldebost.github.io/cmp_pv/

## Configuration ##
| Command | Type | Description |
| --- | --- | --- |
| gdprApplies | boolean | Does GDRP applies (Default:true) |
| hasGlobalScope | boolean | Store cookie globaly |
| cookieDomain | String | Cookie domain for publisher consent string (Default: paruvendu.fr) |
| urlVendorList | String | (Default: https://vendorlist.consensu.org/vendorlist.json) |
| urlCookiesUsage | String | URL for cookie usage description (Default: https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#pc) |
| consentCallback | Function | Function callback after consentement |
| dayCheckInterval | Int | Number of days (Default:30) |
| globalConsentLocation | String | URL to portal.html |


##### Example : #####
```
window.__cmp('init', {
	urlVendorList: 'test/vendorlist.json',
	consentCallback: function () {console.info('Callback');}
});
```

## TODO  List ##
TODO V1 (CMP) :
- [x] Vérifié tous les X jours la vendorlist
- [x] Bug IE9
- [ ] Prise en compte Legitimate Interest "legIntPurposeIds"
- [x] Ajouter Callback après validation
- [ ] Responsive
- [x] Encodage vendorIds type range
- [x] Lien vers la politique cookies
- [x] Purposes Paruvendu.fr
- [x] Global cookie (cmp.paruvendu.consensu.org)
- [ ] Stats
- [x] Specify cookie domain

TODO V2 (Cookie Manager) :