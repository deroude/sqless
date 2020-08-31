import { firestore } from 'firebase';

export interface Account {
    accountType: 'FREE' | 'PREMIUM';
    dateJoined: firestore.Timestamp;
}
