const GITHUB_RELEASES_API = 'https://api.github.com/repos/justelson/dev_scope/releases?per_page=10'
const FALLBACK_RELEASES_URL = 'https://github.com/justelson/dev_scope/releases'

interface GitHubReleaseAsset {
    name: string
    browser_download_url: string
}

interface GitHubRelease {
    draft: boolean
    html_url: string
    tag_name: string
    assets: GitHubReleaseAsset[]
}

export interface ReleaseDownloadTarget {
    downloadUrl: string
    versionLabel: string | null
}

function pickWindowsInstallerAsset(release: GitHubRelease): GitHubReleaseAsset | null {
    return release.assets.find((asset) => asset.name.toLowerCase().endsWith('.exe')) ?? null
}

export async function resolveLatestReleaseDownload(signal?: AbortSignal): Promise<ReleaseDownloadTarget> {
    try {
        const response = await fetch(GITHUB_RELEASES_API, {
            headers: {
                Accept: 'application/vnd.github+json'
            },
            signal
        })

        if (!response.ok) {
            throw new Error(`GitHub release lookup failed with ${response.status}`)
        }

        const releases = (await response.json()) as GitHubRelease[]
        const release = releases.find((candidate) => !candidate.draft && pickWindowsInstallerAsset(candidate))
        const asset = release ? pickWindowsInstallerAsset(release) : null

        if (release && asset) {
            return {
                downloadUrl: asset.browser_download_url,
                versionLabel: release.tag_name
            }
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error
        }
    }

    return {
        downloadUrl: FALLBACK_RELEASES_URL,
        versionLabel: null
    }
}
