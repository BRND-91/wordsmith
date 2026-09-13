import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { makeDictionary } from '../dictionary.js';
import { makeRanks } from '../frequency.js';

// RN can't use the engine's readFileSync loader, so the bundled .txt assets are
// resolved to a local uri and read as text, then handed to the same pure
// builders the node path uses. The engine stays untouched. On web the asset is
// a served URL and expo-file-system has no read, so it goes through fetch.
async function readAsset(mod) {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  if (Platform.OS === 'web') return (await fetch(asset.uri)).text();
  return FileSystem.readAsStringAsync(asset.localUri);
}

export async function loadGameData() {
  const [wordsText, ranksText] = await Promise.all([
    readAsset(require('../../assets/words.txt')),
    readAsset(require('../../assets/ranks.txt')),
  ]);
  const dict = makeDictionary(wordsText.split('\n'));
  const ranks = makeRanks(
    ranksText
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [word, rank] = line.split('\t');
        return [word, Number(rank)];
      }),
  );
  return { dict, ranks };
}
