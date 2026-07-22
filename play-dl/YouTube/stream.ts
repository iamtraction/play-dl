import { request_content_length, request_stream } from '../Request';
import { LiveStream, Stream } from './classes/LiveStream';
import { HLSStream } from './classes/HLSStream';
import { SeekStream } from './classes/SeekStream';
import { InfoData, StreamInfoData } from './utils/constants';
import { video_stream_info } from './utils/extractor';
import { URL } from 'node:url';

export enum StreamType {
    Arbitrary = 'arbitrary',
    Raw = 'raw',
    OggOpus = 'ogg/opus',
    WebmOpus = 'webm/opus',
    Opus = 'opus'
}

export interface StreamOptions {
    seek?: number;
    quality?: number;
    language?: string;
    htmldata?: boolean;
    precache?: number;
    discordPlayerCompatibility?: boolean;
}

/**
 * Command to find audio formats from given format array
 * @param formats Formats to search from
 * @returns Audio Formats array
 */
export function parseAudioFormats(formats: any[]) {
    const result: any[] = [];
    formats.forEach((format) => {
        const type = format.mimeType as string;
        if (type.startsWith('audio')) {
            format.codec = type.split('codecs="')[1].split('"')[0];
            format.container = type.split('audio/')[1].split(';')[0];
            result.push(format);
        }
    });
    return result;
}
/**
 * Type for YouTube Stream
 */
export type YouTubeStream = Stream | LiveStream | SeekStream | HLSStream;
/**
 * Stream command for YouTube
 * @param url YouTube URL
 * @param options lets you add quality for stream
 * @returns Stream class with type and stream for playing.
 */
export async function stream(url: string, options: StreamOptions = {}): Promise<YouTubeStream> {
    const info = await video_stream_info(url, { htmldata: options.htmldata, language: options.language });
    return await stream_from_info(info, options);
}
/**
 * Stream command for YouTube using info from video_info or decipher_info function.
 * @param info video_info data
 * @param options lets you add quality for stream
 * @returns Stream class with type and stream for playing.
 */
export async function stream_from_info(
    info: InfoData | StreamInfoData,
    options: StreamOptions = {}
): Promise<YouTubeStream> {
    if (info.format.length === 0)
        throw new Error('Upcoming and premiere videos that are not currently live cannot be streamed.');
    if (options.quality && !Number.isInteger(options.quality))
        throw new Error("Quality must be set to an integer.")

    const final: any[] = [];
    if (
        info.LiveStreamData.isLive === true &&
        info.LiveStreamData.dashManifestUrl !== null &&
        info.video_details.durationInSec === 0
    ) {
        return new LiveStream(
            info.LiveStreamData.dashManifestUrl,
            info.format[info.format.length - 1].targetDurationSec as number,
            info.video_details.url,
            options.precache
        );
    }

    // Pick a playable source, in order of preference:
    //   1. an audio-only format with a direct URL (best; can be Opus, no ffmpeg)
    //   2. the video's HLS manifest (AAC; needs ffmpeg)
    //   3. any format with a direct URL, usually a muxed one (AAC; needs ffmpeg)
    // YouTube's SABR migration means (1) is often unavailable now, so (2)/(3)
    // act as fallbacks before giving up.
    const audioFormat = parseAudioFormats(info.format).filter((f) => f.url);
    if (audioFormat.length === 0) {
        if (info.LiveStreamData.hlsManifestUrl) return new HLSStream(info.LiveStreamData.hlsManifestUrl);
        const progressive = info.format.find((f) => f.url);
        if (!progressive || !progressive.url)
            throw new Error('No playable stream source (direct URL or HLS manifest) was returned for this video.');
        const progressiveUrl = progressive.url;
        const length = progressive.contentLength
            ? Number(progressive.contentLength)
            : await request_content_length(progressiveUrl);
        return new Stream(
            progressiveUrl,
            StreamType.Arbitrary,
            info.video_details.durationInSec,
            length,
            info.video_details.url,
            options
        );
    }
    if (typeof options.quality !== 'number') options.quality = audioFormat.length - 1;
    else if (options.quality <= 0) options.quality = 0;
    else if (options.quality >= audioFormat.length) options.quality = audioFormat.length - 1;
    final.push(audioFormat[options.quality]);
    let type: StreamType =
        final[0].codec === 'opus' && final[0].container === 'webm' ? StreamType.WebmOpus : StreamType.Arbitrary;
    await request_stream(`https://${new URL(final[0].url).host}/generate_204`);
    if (type === StreamType.WebmOpus) {
        if (!options.discordPlayerCompatibility) {
            options.seek ??= 0;
            if (options.seek >= info.video_details.durationInSec || options.seek < 0)
                throw new Error(`Seeking beyond limit. [ 0 - ${info.video_details.durationInSec - 1}]`);
            return new SeekStream(
                final[0].url,
                info.video_details.durationInSec,
                final[0].indexRange.end,
                Number(final[0].contentLength),
                Number(final[0].bitrate),
                info.video_details.url,
                options
            );
        } else if (options.seek) throw new Error('Can not seek with discordPlayerCompatibility set to true.');
    }

    let contentLength;
    if (final[0].contentLength) {
        contentLength = Number(final[0].contentLength);
    } else {
        contentLength = await request_content_length(final[0].url);
    }

    return new Stream(
        final[0].url,
        type,
        info.video_details.durationInSec,
        contentLength,
        info.video_details.url,
        options
    );
}
