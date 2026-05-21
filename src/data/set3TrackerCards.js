import spoilerData from './set3Spoilers.json';
import { buildSet3TrackerCard } from '../lib/cardMetadata.js';

const set3TrackerCards = spoilerData.cards.map(buildSet3TrackerCard);

export default set3TrackerCards;
