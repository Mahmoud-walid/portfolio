// import * as admin from 'firebase-admin';
// import { getFirestore } from 'firebase-admin/firestore';
// import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
// import inquirer from 'inquirer';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const colors = {
//   reset: '\x1b[0m',
//   bold: '\x1b[1m',
//   dim: '\x1b[2m',
//   red: '\x1b[31m',
//   green: '\x1b[32m',
//   yellow: '\x1b[33m',
//   blue: '\x1b[34m',
//   cyan: '\x1b[36m',
//   bgRed: '\x1b[41m',
//   bgGreen: '\x1b[42m',
// };

// const SERVICE_ACCOUNT_PATH = path.join(
//   __dirname,
//   '../src/firebase/smcet-cms-firebase-service_account.json',
// );

// if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
//   console.error(
//     `${colors.bgRed}${colors.bold} ERROR ${colors.reset} ${colors.red}serviceAccountKey.json file was not found in the project root directory.${colors.reset}`,
//   );
//   console.error(
//     `${colors.dim}INFO: Please download the file from Firebase Console, rename it to serviceAccountKey.json, and place it next to package.json${colors.reset}`,
//   );
//   process.exit(1);
// }

// const serviceAccount = JSON.parse(
//   fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'),
// );

// admin.initializeApp({
//   credential: admin.cert(serviceAccount),
// });

// const db = getFirestore();
// const messaging = getMessaging();

// /**
//  * @interface Answers
//  * @description Represents the structured answers received from the interactive terminal wizard prompt.
//  * @property {string} title - The mandatory notification headline or main title.
//  * @property {string} body - The main text content and message payload of the notification.
//  * @property {string} [image] - Optional URL hosted online pointing to a banner or image resource.
//  * @property {string} [link] - Optional destination URL to open on the user device once the notification is clicked.
//  */
// interface Answers {
//   title: string;
//   body: string;
//   image?: string;
//   link?: string;
// }

// /**
//  * @function startNotificationWizard
//  * @async
//  * @description Triggers the interactive prompt wizard to broadcast custom FCM push notifications
//  * to target devices fetched from Firestore, followed by an automated bulk cleanup process that
//  * deletes expired or unregistered device tokens based on multicast failure responses.
//  * @returns {Promise<void>} Resolves once notification wizard loop completes and terminates cleanly.
//  */
// async function startNotificationWizard(): Promise<void> {
//   try {
//     const snapshot = await db.collection('developer_tokens').get();
//     const tokens = snapshot.docs.map((doc) => doc.id);

//     if (tokens.length === 0) {
//       console.log(
//         `${colors.yellow}WARN: No registered tokens found in "developer_tokens" collection.${colors.reset}`,
//       );
//       process.exit(0);
//     }

//     console.log(
//       `${colors.cyan}INFO: Found ${tokens.length} target devices. Starting notification setup...${colors.reset}\n`,
//     );

//     const answers = await inquirer.prompt<Answers>([
//       {
//         type: 'input',
//         name: 'title',
//         message: 'Enter notification title:',
//         validate: (input) => (input.trim() ? true : 'Title is required!'),
//       },
//       {
//         type: 'input',
//         name: 'body',
//         message: 'Enter notification body content:',
//         validate: (input) =>
//           input.trim() ? true : 'Body content is required!',
//       },
//       {
//         type: 'input',
//         name: 'image',
//         message: 'Enter image URL (Optional - Press Enter to skip):',
//         default: '',
//       },
//       {
//         type: 'input',
//         name: 'link',
//         message:
//           'Enter target click action URL (Optional - Press Enter to skip):',
//         default: 'https://smcet-cms.vercel.app',
//       },
//     ]);

//     const defaultIcon = 'https://vercel.app';

//     const payload: MulticastMessage = {
//       data: {
//         title: answers.title,
//         body: answers.body,
//         icon: defaultIcon,
//         link: answers.link || '',
//       },
//       tokens,
//     };

//     if (answers.image && answers.image.trim() !== '') {
//       payload.data!.image = answers.image.trim();
//     }

//     if (answers.link && answers.link.trim() !== '') {
//       payload.webpush = {
//         fcmOptions: {
//           link: answers.link.trim(),
//         },
//       };
//     }

//     console.log(
//       `\n${colors.bold}${colors.blue}STATUS: Broadcasting notifications to all target devices...${colors.reset}`,
//     );
//     const response = await messaging.sendEachForMulticast(payload);

//     console.log(
//       `\n${colors.bold}${colors.cyan}--- Overall Results ---${colors.reset}`,
//     );
//     console.log(
//       `${colors.green}SUCCESS: Delivered successfully to ${colors.bold}${response.successCount}${colors.reset}${colors.green} devices.${colors.reset}`,
//     );
//     console.log(
//       `${colors.red}FAILURE: Failed delivery to ${colors.bold}${response.failureCount}${colors.reset}${colors.red} devices.${colors.reset}`,
//     );

//     if (response.failureCount > 0) {
//       const failedTokens: string[] = [];

//       response.responses.forEach((resp, index) => {
//         if (!resp.success) {
//           failedTokens.push(tokens[index]);
//         }
//       });

//       console.log(
//         `\n${colors.dim}CLEANUP: Removing ${failedTokens.length} invalid tokens from Firestore...${colors.reset}`,
//       );

//       const batch = db.batch();
//       failedTokens.forEach((token) => {
//         batch.delete(db.collection('developer_tokens').doc(token));
//       });

//       await batch.commit();
//       console.log(
//         `${colors.bold}${colors.green}CLEANUP: Database updated successfully.${colors.reset}`,
//       );
//     }

//     process.exit(0);
//   } catch (error) {
//     console.error(
//       `\n${colors.bgRed}${colors.bold} CRITICAL ERROR ${colors.reset} ${colors.red}An unexpected error occurred:${colors.reset}`,
//       error,
//     );
//     process.exit(1);
//   }
// }

// startNotificationWizard();
