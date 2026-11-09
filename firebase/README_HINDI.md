# Firebase Console सेटअप (Phase 4)

1. Firebase Console में अपना मौजूदा project `jangidcricinfolive` खोलें।
2. Project settings → General → Your apps में Web App config देखें। यदि Web App नहीं है, तो एक Web App जोड़ें।
3. `firebase-config.example.js` की copy बनाकर उसका नाम `firebase-config.js` रखें।
4. Firebase Console से Web App config के मान भरें। `databaseURL` वही डालें जो Realtime Database में दिखता है।
5. Authentication → Sign-in method में Email/Password और Google provider चालू करें।
6. Google provider के support email और authorized domains को सही रखें। GitHub Pages domain बाद में जोड़ना होगा।
7. Firestore और RTDB के लिए deny-all starter rules को अभी publish न करें। अगली migration में data schema और owner/admin access rules के साथ rules बनाए जाएँगे।

## सुरक्षा
- `firebase-config.js` में केवल Firebase Web App config होता है; यह Admin SDK private key नहीं है।
- Service-account JSON, private key या Admin SDK को `public/` folder में कभी न रखें।
- `users/{uid}` में client को `isAdmin`, `plan`, `expiry`, `subscriptionStatus` जैसे privileged fields लिखने की अनुमति न दें।
- Google + Email/Password same-email linking का पूरा flow अभी इस चरण में implement नहीं है। Firebase के account collision को सुरक्षित तरीके से handle करना अगले चरण का काम है।
- Email verification भेजी जाती है, लेकिन इस चरण में unverified account को सभी app pages से रोकने का enforcement अभी नहीं जुड़ा है।
