// import admin from 'firebase-admin';
// import { getFirestore } from 'firebase-admin/firestore';
// import { getMessaging } from 'firebase-admin/messaging';

// if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
//   console.error(
//     'Error: FIREBASE_SERVICE_ACCOUNT environment variable is missing.',
//   );
//   process.exit(1);
// }

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// admin.initializeApp({
//   credential: admin.cert(serviceAccount),
// });

// const db = getFirestore();
// const messaging = getMessaging();

// async function sendNotifications() {
//   try {
//     const snapshot = await db.collection('developer_tokens').get();
//     const tokens = snapshot.docs.map((doc) => doc.id);

//     if (tokens.length === 0) {
//       console.log('No registered devices found.');
//       process.exit(0);
//     }

//     const state = process.env.DEPLOY_STATE;
//     const stateTitle =
//       state === 'success' ? '✅ نجاح تحديث المنصة' : '❌ فشل تحديث المنصة';

//     const shortSha = process.env.COMMIT_SHA
//       ? process.env.COMMIT_SHA.substring(0, 7)
//       : '';

//     const bodyText =
//       `📦 ${process.env.REPO_NAME}\n` +
//       `👤 ${process.env.COMMIT_AUTHOR}\n` +
//       `📝 ${process.env.COMMIT_MSG}\n` +
//       `🔗 Commit: ${shortSha}`;

//     const deployLink =
//       process.env.DEPLOY_URL ||
//       `https://github.com/${process.env.REPO_NAME}/commit/${process.env.COMMIT_SHA}`;

//     const iconUrl = 'https://smcet-cms.vercel.app/images/logo-only.webp';

//     const payload = {
//       data: {
//         title: stateTitle,
//         body: bodyText,
//         icon: iconUrl,
//         link: deployLink,
//       },
//       webpush: {
//         fcmOptions: {
//           link: deployLink,
//         },
//       },
//       tokens,
//     };

//     const response = await messaging.sendEachForMulticast(payload);
//     console.log(JSON.stringify(response, null, 2));

//     if (response.failureCount > 0) {
//       const failedTokens: string[] = [];

//       response.responses.forEach((resp, index) => {
//         if (!resp.success) {
//           failedTokens.push(tokens[index]);
//         }
//       });

//       console.log('Removing invalid tokens:', failedTokens);

//       const batch = db.batch();
//       failedTokens.forEach((token) => {
//         batch.delete(db.collection('developer_tokens').doc(token));
//       });

//       await batch.commit();
//     }
//   } catch (error) {
//     console.error(error);
//     process.exit(1);
//   }
// }

// sendNotifications();
