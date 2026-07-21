import { ChannelCollaborator } from '../classes/Channel';

/**
 * Resolved channel info from a video/playlist owner (byline) run.
 *
 * `id`/`name`/`url` always reference the primary (first) channel so existing
 * consumers keep working. `collaborators` is only set for collaboration content
 * credited to more than one channel.
 */
export interface ParsedChannelRun {
    id: string | null;
    name: string | null;
    url: string;
    collaborators?: ChannelCollaborator[];
}

/**
 * Builds a channel URL from a `navigationEndpoint` node, or `''` when it has none.
 * @param navigationEndpoint A run's (or renderer's) `navigationEndpoint`.
 */
function channelUrlFromNavigation(navigationEndpoint?: any): string {
    const path =
        navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
        navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
    return path ? `https://www.youtube.com${path}` : '';
}

/**
 * Resolves channel info from an owner/byline run (e.g. `ownerText.runs[0]` for
 * videos, `shortBylineText.runs[0]` for playlists).
 *
 * Handles the three shapes YouTube uses:
 *  a. `navigationEndpoint.browseEndpoint` present → a single channel.
 *  b. `navigationEndpoint.showDialogCommand` present → a collaboration crediting
 *     multiple channels via a "Collaborators" picker. The first collaborator is
 *     returned as the primary channel and all of them are listed in `collaborators`.
 *  c. neither present → only the run text is available.
 * @param run An owner/byline run object.
 * @param ownerNavigationEndpoint An optional renderer-level `navigationEndpoint` to
 *        resolve the URL from when the run itself carries none (some sites, e.g.
 *        playlist owners, keep the channel link one level up from the text run).
 * @returns The resolved primary channel and, for collaborations, all collaborators.
 */
export function parseChannelFromRun(run?: any, ownerNavigationEndpoint?: any): ParsedChannelRun {
    if (!run) return { id: null, name: null, url: channelUrlFromNavigation(ownerNavigationEndpoint) };

    const navigationEndpoint = run.navigationEndpoint;

    // Case a: a single channel with a browse endpoint.
    if (navigationEndpoint?.browseEndpoint) {
        return {
            id: navigationEndpoint.browseEndpoint.browseId ?? null,
            name: run.text ?? null,
            url: channelUrlFromNavigation(navigationEndpoint) || channelUrlFromNavigation(ownerNavigationEndpoint)
        };
    }

    // Case b: a collaboration crediting multiple channels via a picker dialog.
    const listItems =
        navigationEndpoint?.showDialogCommand?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent
            ?.listViewModel?.listItems;
    if (Array.isArray(listItems)) {
        const collaborators: ChannelCollaborator[] = [];
        for (const item of listItems) {
            const model = item?.listItemViewModel;
            if (!model) continue;
            const command = model.rendererContext?.commandContext?.onTap?.innertubeCommand;
            const id = command?.browseEndpoint?.browseId ?? null;
            const name = model.title?.content ?? null;
            if (!id && !name) continue;
            const path = command?.commandMetadata?.webCommandMetadata?.url;
            collaborators.push({ id, name, url: path ? `https://www.youtube.com${path}` : '' });
        }
        if (collaborators.length) {
            const [primary] = collaborators;
            return { id: primary.id, name: primary.name, url: primary.url, collaborators };
        }
    }

    // Case c: no navigation info on the run, only the display text is available.
    return { id: null, name: run.text ?? null, url: channelUrlFromNavigation(ownerNavigationEndpoint) };
}
