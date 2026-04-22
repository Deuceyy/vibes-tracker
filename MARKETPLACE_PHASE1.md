# Marketplace Phase 1

This repo uses Firebase Auth + Firestore directly from the client, so Phase 1 marketplace "schema" is expressed as document shapes rather than SQL migrations.

## Extended user document

`users/{uid}`

- `username`
- `displayName`
- `photoURL`
- `role` or `isAdmin` for protected admin views
- `sellerProfile`
  - `displayName`
  - `bio`
  - `location`
  - `shippingRegion`
  - `contactMethods`
  - `externalLinks[]`
  - `socialLinks[]`
  - `avatarUrl`
  - `verified`

## Listings

`listings/{listingId}`

- `cardId`
- `cardName`
- `cardImageUrl`
- `set`
- `setNumber`
- `rarity`
- `type`
- `searchText`
- `sellerUserId`
- `sellerUsername`
- `sellerDisplayName`
- `sellerAvatarUrl`
- `sellerVerified`
- `quantity`
- `condition`
- `price`
- `shippingPrice`
- `notes`
- `language`
- `variant`
- `status` (`active`, `pending`, `sold`, `inactive`)
- `createdAt`
- `updatedAt`

## Conversations

`conversations/{conversationId}`

- `listingId`
- `listingSnapshot`
  - `cardId`
  - `cardName`
  - `cardImageUrl`
  - `price`
  - `quantity`
  - `condition`
  - `variant`
  - `status`
- `buyerUserId`
- `sellerUserId`
- `participantIds[]`
- `participantProfiles`
- `intentType` (`contact`, `commit`)
- `messageCount`
- `lastMessagePreview`
- `lastMessageAt`
- `unreadBy[]`
- `createdAt`
- `updatedAt`

## Messages

`conversations/{conversationId}/messages/{messageId}`

- `authorId`
- `authorDisplayName`
- `body`
- `createdAt`
- `system`

## Firebase follow-up

- Add or update Firestore security rules so only sellers can edit their listings, only participants can post in their conversations, and admins can read moderation views.
- If Firestore prompts for composite indexes in production, create them from the Firebase console based on the generated links.
