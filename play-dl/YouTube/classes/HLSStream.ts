import { Readable } from 'node:stream';
import { IncomingMessage } from 'node:http';
import { request, request_stream } from '../../Request';
import { StreamType } from '../stream';

/**
 * YouTube HLS Stream class for playing audio from a video's HLS manifest.
 *
 * Used for normal (VOD) videos now that YouTube serves the mobile InnerTube
 * clients via SABR/HLS with no direct progressive format URLs. It selects the
 * best audio-only rendition from the HLS manifest and pushes its segments to
 * the readable stream in order.
 *
 * NOTE: prototype — segments are fetched back-to-back with no pacing/backpressure
 * beyond the readable's highWaterMark. Fine for playback via ffmpeg; a production
 * version should pace fetches like {@link LiveStream}/{@link Stream}.
 */
export class HLSStream {
    /**
     * Readable Stream through which data passes.
     */
    stream: Readable;
    /**
     * Type of audio data. HLS segments are MPEG-TS, handled downstream by ffmpeg.
     */
    type: StreamType;
    /**
     * Incoming message currently being read, kept so the TCP connection can be
     * destroyed if the consumer stops playback mid-stream.
     */
    private request?: IncomingMessage;
    /**
     * Ordered list of audio segment URLs from the media playlist.
     */
    private segments: string[];
    /**
     * Index of the next segment to fetch.
     */
    private index: number;
    /**
     * HLS Stream Class constructor.
     * @param manifestUrl HLS variant manifest URL (streamingData.hlsManifestUrl)
     */
    constructor(manifestUrl: string) {
        this.stream = new Readable({ highWaterMark: 5 * 1000 * 1000, read() {} });
        this.type = StreamType.Arbitrary;
        this.segments = [];
        this.index = 0;
        this.stream.on('close', () => this.cleanup());
        this.initialize(manifestUrl).catch((err: Error) => this.stream.destroy(err));
    }
    /**
     * Fetches the manifest, resolves the best playable rendition, extracts its
     * segment URLs, and starts streaming them.
     */
    private async initialize(manifestUrl: string) {
        const manifest = await request(manifestUrl);
        this.segments = await this.resolveSegments(manifest);
        if (this.segments.length === 0) throw new Error('No playable segments found in the HLS manifest.');
        this.loop();
    }
    /**
     * Resolves the ordered segment list from the master manifest: prefers a
     * separate audio rendition (best quality, least data), and falls back to the
     * lowest-bitrate muxed variant stream when the manifest has no audio-only
     * rendition. Attribute order within a line is not assumed.
     */
    private async resolveSegments(manifest: string): Promise<string[]> {
        const lines = manifest.split('\n');
        const audioUris = lines
            .filter((line) => line.startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO/.test(line))
            .map((line) => line.match(/URI="([^"]+)"/)?.[1])
            .filter((uri): uri is string => Boolean(uri));
        let mediaUrl = audioUris[audioUris.length - 1];
        if (!mediaUrl) {
            // No audio-only rendition: use the first (lowest-bitrate) muxed variant.
            const variantIndex = lines.findIndex((line) => line.startsWith('#EXT-X-STREAM-INF'));
            if (variantIndex !== -1) mediaUrl = lines[variantIndex + 1]?.trim();
        }
        if (!mediaUrl) return [];
        const media = await request(mediaUrl);
        return media.split('\n').filter((line) => line.length > 0 && !line.startsWith('#'));
    }
    /**
     * Sequentially requests each segment and pushes its bytes to the stream,
     * ending the stream once all segments are consumed.
     */
    private async loop() {
        if (this.stream.destroyed) return this.cleanup();
        if (this.index >= this.segments.length) {
            this.stream.push(null);
            return;
        }
        const segment = await request_stream(this.segments[this.index]).catch((err: Error) => err);
        if (segment instanceof Error) {
            this.stream.destroy(segment);
            return;
        }
        if (Number(segment.statusCode) >= 400) {
            this.stream.destroy(new Error(`HLS segment request failed with status ${segment.statusCode}.`));
            return;
        }
        this.request = segment;
        segment.on('data', (chunk) => this.stream.push(chunk));
        segment.once('error', (err) => this.stream.destroy(err));
        segment.on('end', () => {
            this.index++;
            this.loop();
        });
    }
    /**
     * Cleans up used variables and destroys the active request.
     */
    private cleanup() {
        this.request?.destroy();
        this.request = undefined;
        this.segments = [];
    }
    /**
     * Deprecated Functions
     */
    pause() {}
    /**
     * Deprecated Functions
     */
    resume() {}
}
