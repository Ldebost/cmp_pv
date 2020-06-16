# cmp_pv
> ParuVendu.fr Consent Management Platform (TCF v2)

Démo : https://ldebost.github.io/cmp_pv/

## Configuration ##
| Option | Type | Description |
| --- | --- | --- |
| cookieDomain | String | Cookie domain for publisher consent string (Default: paruvendu.fr) |
| cookieSecure | boolean | Cookie secure flag (Default:true) |
| dayCheckInterval | Int | Number of days (Default:30) |
| firstScreenPurposes | Object | Purposes and Stack to be displayed on first screen |
| gdprApplies | boolean | Does GDRP applies (Default:true) |
| globalConsentLocation | String | URL to portal.html |
| hasGlobalScope | boolean | Store cookie globally on consensu.org (Default:false) |
| publisherName | String | Name of publisher (Default: ParuVendu.fr) |
| uiColor | String | Main color of UI (Default: #EE1C24) |
| urlCookiesUsage | String | URL for cookie usage description (Default: https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#pc) |
| urlVendorList | String | URL of IAB's vendorlist |

Google’s Additional Consent Mode : https://support.google.com/admanager/answer/9681920

| Option | Type | Description |
| --- | --- | --- |
| googleAC | boolean | Add Google's vendors (Default: true) |
| urlGoogleACList | String | URL of Google's vendorlist |


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

## TCF v1 (obsolete) ##
[TCF v1 branch](tree/tcf_v1)