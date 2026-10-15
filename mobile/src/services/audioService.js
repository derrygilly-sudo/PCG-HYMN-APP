// src/services/audioService.js
/* eslint-disable import/namespace */
import * as FileSystem from 'expo-file-system/legacy';
import { addTuneDownload, removeTuneDownload } from '../database/localDb';
import { AUDIO_DIRECTORY } from '../utils/constants';

const getAudioDirectory = () => {
  return (FileSystem.documentDirectory || '') + AUDIO_DIRECTORY;
};

// A hymn can have several tunes, each saved as its own file.
// The "main" tune keeps the original file name so older downloads still work.
const getFileName = (hymnId, tuneId = 'main') =>
  tuneId === 'main' ? `hymn_${hymnId}.mp3` : `hymn_${hymnId}_${tuneId}.mp3`;

const ensureDirectoryExists = async () => {
  const dir = getAudioDirectory();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

export const downloadAudio = async (hymnId, audioUrl, onProgress, tuneId = 'main') => {
  try {
    const dir = await ensureDirectoryExists();
    const filePath = dir + getFileName(hymnId, tuneId);

    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      filePath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) {
          onProgress(progress);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (result && result.uri) {
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      addTuneDownload(hymnId, tuneId, result.uri, fileInfo.size || 0);
      return { success: true, path: result.uri };
    }

    return { success: false, error: 'Download failed' };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteDownloadedAudio = async (hymnId, tuneId = 'main') => {
  try {
    const dir = getAudioDirectory();
    const filePath = dir + getFileName(hymnId, tuneId);

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }

    removeTuneDownload(hymnId, tuneId);
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }
};

export const getLocalAudioPath = async (hymnId, tuneId = 'main') => {
  try {
    const dir = getAudioDirectory();
    const filePath = dir + getFileName(hymnId, tuneId);

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      return filePath;
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const getTotalDownloadSize = async () => {
  try {
    const dir = getAudioDirectory();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) return 0;

    const files = await FileSystem.readDirectoryAsync(dir);
    let totalSize = 0;

    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(dir + file);
      totalSize += fileInfo.size || 0;
    }

    return totalSize;
  } catch (error) {
    return 0;
  }
};
