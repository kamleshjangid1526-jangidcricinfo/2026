JANGID CRICINFO — GITHUB PAGES + FIREBASE PACKAGE
=================================================

यह एकीकृत GitHub Pages package है। सभी files repository के main branch में रखें; ZIP file को repository में अकेले upload न करें।

मुख्य पन्ने:
- index.html: Public Homepage
- control.html: Control Board और Live Scoring
- tournament-public.html: Public Tournament
- scoreboard.html: Public Scorecard
- scorelayer.html: OBS Browser Source
- admin.html: Admin Center
- register.html: नया खाता

Firebase Web App config आपके दिए screenshots से जोड़ दी गई है। इसमें browser की सार्वजनिक पहचान है; कोई Admin SDK credential नहीं है।

आवश्यक Firebase Console setup के आसान चरण FIREBASE_CONFIG_ALREADY_ADDED_HINDI.txt में हैं। Firestore Rules की file firestore.rules है। Authentication Email/Password और Firestore database चालू होने के बाद ही Login तथा cloud save चलेंगे।

GitHub Pages deploy workflow `.github/workflows/pages.yml` में है। Public repository के main branch पर files upload/commit होने के बाद Actions tab में deploy status देखें।

ध्यान दें: GitHub Pages public static hosting है। Database, Login और authorization Firebase से चलते हैं। अपने पुराने `data.json`, backups, `.env`, passwords, Service Account JSON और Private Keys repository में न डालें।

यह package तैयार किया गया है लेकिन इसे अभी आपके GitHub account में publish नहीं किया गया है और Firebase Console/दूसरे device/OBS पर end-to-end test नहीं हुआ है।
