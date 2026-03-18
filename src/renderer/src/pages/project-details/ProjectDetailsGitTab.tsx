import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { WorkingChangesView } from './WorkingChangesView'
import { ProjectDetailsGitHeader } from './ProjectDetailsGitHeader'
import { ProjectDetailsGitManageView } from './ProjectDetailsGitManageView'
import { PullRequestModal } from './PullRequestModal'
import { useProjectDetailsGitViewModel } from './useProjectDetailsGitViewModel'
import { getRefreshModeForGitView } from './projectDataLifecycle/gitLifecycleUtils'
import {
    ProjectDetailsGitHistoryView,
    ProjectDetailsGitPullsView,
    ProjectDetailsGitUnpushedView,
    ProjectDetailsRepoInfoModal
} from './ProjectDetailsGitViews'

interface ProjectDetailsGitTabProps {
    lastFetched?: number
    lastPulled?: number
    [key: string]: any
}

export function ProjectDetailsGitTab(props: ProjectDetailsGitTabProps) {
    const { updateSettings } = useSettings()
    const {
        project,
        gitUser,
        repoOwner,
        gitView,
        setGitView,
        changedFiles,
        stagedFiles,
        unstagedFiles,
        unpushedCommits,
        incomingCommits,
        gitSyncStatus,
        refreshGitData,
        loadingGit,
        loadingGitHistory,
        gitError,
        decodedPath,
        handleCommitClick,
        pullsPage,
        setPullsPage,
        ITEMS_PER_PAGE,
        COMMITS_PER_PAGE,
        commitPage,
        setCommitPage,
        gitHistory,
        gitHistoryTotalCount,
        historyHasMore,
        loadingMoreHistory,
        loadMoreGitHistory,
        commitMessage,
        setCommitMessage,
        handleGenerateCommitMessage,
        isGeneratingCommitMessage,
        isCommitting,
        settings,
        handleCommit,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleDiscardUnstagedFile,
        handleDiscardUnstagedAll,
        ensureStatsForPaths,
        hasRemote,
        setInitStep,
        setShowInitModal,
        currentBranch,
        branches,
        handlePush,
        isPushing,
        handleFetch,
        handlePull,
        isFetching,
        isPulling,
        remotes,
        showToast
    } = props

    const [showPullRequestModal, setShowPullRequestModal] = useState(false)
    const [showRepoInfoModal, setShowRepoInfoModal] = useState(false)
    const {
        githubPublishContext,
        loadingGitHubPublishContext,
        gitHubPublishContextError,
        refreshGitHubPublishContext,
        hasGitHubRemote,
        repoUsesForkOrigin,
        originRepoDisplay,
        upstreamRepoDisplay,
        canFetchOrigin,
        showFetchUpstreamButton,
        canSyncFromUpstream,
        pushAccessIndicator,
        compactPushSummaryLines,
        currentBranchNeedsPublish,
        showPushAction,
        visibleHistorySource,
        visibleHistoryCommits,
        effectiveHistoryTotalCount,
        totalHistoryPages,
        unpushedStatsLoading,
        incomingStatsLoading,
        historyLoading,
        shouldHighlightPull,
        pullStatusItems,
        pagedIncomingCommits,
        localOnlyCommitHashes,
        activeFetchTarget,
        remoteHeadCommitHash,
        handleNextHistoryPage,
        handleFetchOrigin,
        handleFetchUpstream,
        handleSyncFromUpstream,
        originRemoteUrl,
        upstreamRemoteUrl,
        repoFlowSummary,
        ensureUpstreamRemote,
        handleCopyRepoValue
    } = useProjectDetailsGitViewModel({
        repoOwner,
        gitUser,
        remotes,
        decodedPath,
        hasRemote,
        currentBranch,
        branches,
        unpushedCommits,
        incomingCommits,
        gitSyncStatus,
        loadingGit,
        gitError,
        loadingGitHistory,
        gitHistory,
        gitHistoryTotalCount,
        commitPage,
        setCommitPage,
        COMMITS_PER_PAGE,
        historyHasMore,
        loadingMoreHistory,
        loadMoreGitHistory,
        pullsPage,
        ITEMS_PER_PAGE,
        lastFetched: props.lastFetched,
        lastPulled: props.lastPulled,
        handleFetch,
        handlePull,
        refreshGitData,
        showToast
    })
    return (
        <div className="flex flex-col h-full">
            {gitError && (
                <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="break-words">{gitError}</span>
                </div>
            )}

            <ProjectDetailsGitHeader
                gitUser={gitUser}
                repoOwner={repoOwner}
                pushAccessIndicator={pushAccessIndicator}
                gitView={gitView}
                onGitViewChange={setGitView}
                changedFilesCount={changedFiles.length}
                unpushedCommitsCount={unpushedCommits.length}
                behindCount={gitSyncStatus?.behind || 0}
                onOpenRepoInfo={() => setShowRepoInfoModal(true)}
                onRefresh={() => {
                    void refreshGitData(false, { mode: getRefreshModeForGitView(gitView) })
                }}
                refreshDisabled={gitView === 'history' ? historyLoading : loadingGit}
                refreshLoading={gitView === 'history' ? historyLoading : loadingGit}
            />

            <div className="project-surface-scrollbar p-4 flex-1 overflow-y-auto">
                {gitView === 'manage' ? (
                    <ProjectDetailsGitManageView
                        {...props}
                        githubPublishContext={githubPublishContext}
                        loadingGitHubPublishContext={loadingGitHubPublishContext}
                        gitHubPublishContextError={gitHubPublishContextError}
                        hasGitHubRemote={hasGitHubRemote}
                        onOpenCreatePullRequest={() => setShowPullRequestModal(true)}
                    />
                ) : gitView === 'changes' ? (
                    <WorkingChangesView
                        stagedFiles={stagedFiles}
                        unstagedFiles={unstagedFiles}
                        projectPath={decodedPath}
                        commitMessage={commitMessage}
                        setCommitMessage={setCommitMessage}
                        handleGenerateCommitMessage={handleGenerateCommitMessage}
                        isGeneratingCommitMessage={isGeneratingCommitMessage}
                        isCommitting={isCommitting}
                        settings={settings}
                        handleCommit={handleCommit}
                        handleStageFile={handleStageFile}
                        handleUnstageFile={handleUnstageFile}
                        handleStageAll={handleStageAll}
                        handleUnstageAll={handleUnstageAll}
                        handleDiscardUnstagedFile={handleDiscardUnstagedFile}
                        handleDiscardUnstagedAll={handleDiscardUnstagedAll}
                        ensureStatsForPaths={ensureStatsForPaths}
                    />
                ) : gitView === 'unpushed' ? (
                    <ProjectDetailsGitUnpushedView
                        hasRemote={hasRemote}
                        setInitStep={setInitStep}
                        setShowInitModal={setShowInitModal}
                        showPushAction={showPushAction}
                        unpushedStatsLoading={unpushedStatsLoading}
                        currentBranchNeedsPublish={currentBranchNeedsPublish}
                        compactPushSummaryLines={compactPushSummaryLines}
                        hasGitHubRemote={hasGitHubRemote}
                        onOpenCreatePullRequest={() => setShowPullRequestModal(true)}
                        unpushedCommits={unpushedCommits}
                        onCommitClick={handleCommitClick}
                        localOnlyCommitHashes={localOnlyCommitHashes}
                    />
                ) : gitView === 'pulls' ? (
                    <ProjectDetailsGitPullsView
                        repoUsesForkOrigin={repoUsesForkOrigin}
                        incomingStatsLoading={incomingStatsLoading}
                        gitSyncStatus={gitSyncStatus}
                        currentBranch={currentBranch}
                        originRepoDisplay={originRepoDisplay}
                        upstreamRepoDisplay={upstreamRepoDisplay}
                        isFetching={isFetching}
                        activeFetchTarget={activeFetchTarget}
                        canFetchOrigin={canFetchOrigin}
                        showFetchUpstreamButton={showFetchUpstreamButton}
                        canSyncFromUpstream={canSyncFromUpstream}
                        isPulling={isPulling}
                        hasRemote={hasRemote}
                        shouldHighlightPull={shouldHighlightPull}
                        pullStatusItems={pullStatusItems}
                        lastFetched={props.lastFetched}
                        lastPulled={props.lastPulled}
                        pagedIncomingCommits={pagedIncomingCommits}
                        incomingCommits={incomingCommits}
                        pullsPage={pullsPage}
                        setPullsPage={setPullsPage}
                        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                        handleFetchOrigin={handleFetchOrigin}
                        handleFetchUpstream={handleFetchUpstream}
                        handleSyncFromUpstream={handleSyncFromUpstream}
                        handlePull={handlePull}
                        handleCommitClick={handleCommitClick}
                    />
                    ) : gitView === 'history' ? (
                    <ProjectDetailsGitHistoryView
                        historyLoading={historyLoading}
                        visibleHistorySource={visibleHistorySource}
                        visibleHistoryCommits={visibleHistoryCommits}
                        handleCommitClick={handleCommitClick}
                        localOnlyCommitHashes={localOnlyCommitHashes}
                        hasRemote={hasRemote}
                        remoteHeadCommitHash={remoteHeadCommitHash}
                        effectiveHistoryTotalCount={effectiveHistoryTotalCount}
                        COMMITS_PER_PAGE={COMMITS_PER_PAGE}
                        historyHasMore={historyHasMore}
                        loadingMoreHistory={loadingMoreHistory}
                        commitPage={commitPage}
                        totalHistoryPages={totalHistoryPages}
                        setCommitPage={setCommitPage}
                        handleNextHistoryPage={handleNextHistoryPage}
                    />
                    ) : null}
            </div>
            <PullRequestModal
                isOpen={showPullRequestModal}
                onClose={() => setShowPullRequestModal(false)}
                projectName={project?.displayName || project?.name || 'Project'}
                projectPath={decodedPath}
                currentBranch={currentBranch}
                branches={branches}
                remotes={remotes || []}
                unstagedFiles={unstagedFiles}
                stagedFiles={stagedFiles}
                unpushedCommits={unpushedCommits}
                githubPublishContext={githubPublishContext}
                settings={settings}
                updateSettings={updateSettings}
                showToast={showToast}
                onCommitClick={handleCommitClick}
            />
            <ProjectDetailsRepoInfoModal
                open={showRepoInfoModal}
                onClose={() => setShowRepoInfoModal(false)}
                originRepoDisplay={originRepoDisplay}
                originRemoteUrl={originRemoteUrl}
                upstreamRepoDisplay={upstreamRepoDisplay}
                upstreamRemoteUrl={upstreamRemoteUrl}
                githubPublishContext={githubPublishContext}
                repoUsesForkOrigin={repoUsesForkOrigin}
                ensureUpstreamRemote={ensureUpstreamRemote}
                repoFlowSummary={repoFlowSummary}
                handleSyncFromUpstream={handleSyncFromUpstream}
                isPulling={isPulling}
                refreshGitHubPublishContext={refreshGitHubPublishContext}
                handleCopyRepoValue={handleCopyRepoValue}
            />
        </div>
    )
}
