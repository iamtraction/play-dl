export interface ChannelIconInterface {
    /**
     * YouTube Channel Icon URL
     */
    url: string;
    /**
     * YouTube Channel Icon Width
     */
    width: number;
    /**
     * YouTube Channel Icon Height
     */
    height: number;
}
/**
 * A single channel credited on a collaboration video/playlist.
 */
export interface ChannelCollaborator {
    /**
     * YouTube Channel ID.
     */
    id: string | null;
    /**
     * YouTube Channel Title.
     */
    name: string | null;
    /**
     * YouTube Channel Url.
     */
    url: string;
}
/**
 * YouTube Channel Class
 */
export class YouTubeChannel {
    /**
     * YouTube Channel Title
     */
    name?: string;
    /**
     * YouTube Channel Verified status.
     */
    verified?: boolean;
    /**
     * YouTube Channel artist if any.
     */
    artist?: boolean;
    /**
     * YouTube Channel ID.
     */
    id?: string;
    /**
     * YouTube Class type. == "channel"
     */
    type: 'video' | 'playlist' | 'channel';
    /**
     * YouTube Channel Url
     */
    url?: string;
    /**
     * YouTube Channel Icons data.
     */
    icons?: ChannelIconInterface[];
    /**
     * YouTube Channel subscribers count.
     */
    subscribers?: string;
    /**
     * All channels credited on a collaboration video/playlist.
     *
     * Only present when YouTube credits more than one channel. For single-channel
     * content this is `undefined` and {@link YouTubeChannel.id}, {@link YouTubeChannel.name}
     * and {@link YouTubeChannel.url} reference the sole channel.
     */
    collaborators?: ChannelCollaborator[];
    /**
     * YouTube Channel Constructor
     * @param data YouTube Channel data that we recieve from basic info or from search
     */
    constructor(data: any = {}) {
        if (!data) throw new Error(`Cannot instantiate the ${this.constructor.name} class without data!`);
        this.type = 'channel';
        this.name = data.name || null;
        this.verified = !!data.verified || false;
        this.artist = !!data.artist || false;
        this.id = data.id || null;
        this.url = data.url || null;
        this.icons = data.icons || [{ url: null, width: 0, height: 0 }];
        this.subscribers = data.subscribers || null;
        this.collaborators = data.collaborators?.length ? data.collaborators : undefined;
    }

    /**
     * Returns channel icon url
     * @param {object} options Icon options
     * @param {number} [options.size=0] Icon size. **Default is 0**
     */
    iconURL(options = { size: 0 }): string | undefined {
        if (typeof options.size !== 'number' || options.size < 0) throw new Error('invalid icon size');
        if (!this.icons?.[0]?.url) return undefined;
        const def = this.icons?.[0]?.url.split('=s')[1].split('-c')[0];
        return this.icons?.[0]?.url.replace(`=s${def}-c`, `=s${options.size}-c`);
    }
    /**
     * Converts Channel Class to channel name.
     * @returns name of channel
     */
    toString(): string {
        return this.name || '';
    }
    /**
     * Converts Channel Class to JSON format
     * @returns json data of the channel
     */
    toJSON(): ChannelJSON {
        return {
            name: this.name,
            verified: this.verified,
            artist: this.artist,
            id: this.id,
            url: this.url,
            icons: this.icons,
            type: this.type,
            subscribers: this.subscribers,
            collaborators: this.collaborators
        };
    }
}

interface ChannelJSON {
    /**
     * YouTube Channel Title
     */
    name?: string;
    /**
     * YouTube Channel Verified status.
     */
    verified?: boolean;
    /**
     * YouTube Channel artist if any.
     */
    artist?: boolean;
    /**
     * YouTube Channel ID.
     */
    id?: string;
    /**
     * Type of Class [ Channel ]
     */
    type: 'video' | 'playlist' | 'channel';
    /**
     * YouTube Channel Url
     */
    url?: string;
    /**
     * YouTube Channel Icon data.
     */
    icons?: ChannelIconInterface[];
    /**
     * YouTube Channel subscribers count.
     */
    subscribers?: string;
    /**
     * All channels credited on a collaboration video/playlist.
     */
    collaborators?: ChannelCollaborator[];
}
