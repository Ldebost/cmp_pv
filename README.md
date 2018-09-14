# cmp_pv
> ParuVendu.fr Consent Management Platform

Démo : https://ldebost.github.io/cmp_pv/

## Configuration ##
###### gdprApplies : boolean (true|false) ######
If GDRP applies = if in EU

###### hasGlobalScope: boolean (true|false) ######
If GDRP applies globally = global cookie

###### cookieDomain: 'paruvendu.fr',  ######
###### urlVendorList: 'https://vendorlist.consensu.org/vendorlist.json', ######
###### urlCookiesUsage: 'https://www.paruvendu.fr/communfo/defaultcommunfo/defaultcommunfo/infosLegales#pc', ######
###### consentCallback: null, ######
###### dayCheckInterval: 30 ######

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
- [ ] Global cookie (cmp.paruvendu.consensu.org)
- [ ] Stats
- [x] Specify cookie domain

TODO V2 (Cookie Manager):