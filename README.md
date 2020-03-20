# cmp_pv
> ParuVendu.fr Consent Management Platform

Démo : https://ldebost.github.io/cmp_pv/

## Configuration ##
| Command | Type | Description |
| --- | --- | --- |
| gdprApplies | boolean | Does GDRP applies (Default:true) |
| hasGlobalScope | boolean | Store cookie globally on consensu.org |
| cookieDomain | String | Cookie domain for publisher consent string (Default: paruvendu.fr) |
| urlVendorList | String | (Default: https://vendorlist.consensu.org/vendorlist.json) |
| urlCookiesUsage | String | URL for cookie usage description (Default: https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#pc) |
| dayCheckInterval | Int | Number of days (Default:30) |
| globalConsentLocation | String | URL to portal.html |


##### Example : #####
```
window.__tcfapi('init', {
	urlVendorList: 'test/vendorlist.json',
});
```

## TODO  List ##
TODO V2 (CMP) :
- [x] Tcf_v2 : Consent string basic (coreString)
- [ ] Tcv_v2 : Consent string complete support (OOB, ~~Publisher TC~~, Publisher Restrictions)
- [x] Perf : Store tcString instead of calculating every time
- [ ] tcf_v2 : Complete support (Special Purpose One Treatment, Publisher Uses Non-Standard Stacks)

TODO (Cookie Manager) :