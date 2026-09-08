import {
  getRecentUserActivity,
  getPublishedReleaseSummary,
  getCopilotPRsAccountWide,
  getCodexCoauthoredCommitsAccountWide,
  getCodexLabeledPRsAccountWide,
  getClaudeCoauthoredCommitsAccountWide,
  getClaudeLabeledPRsAccountWide,
} from '../data';
import { SiGithubcopilot, SiClaude } from 'react-icons/si';
import { CodexIcon } from './codex-icon';
import { ReactNode } from 'react';

function joinWithAnd(items: ReactNode[]) {
  return items.flatMap((item, index) =>
    index === 0 ? [item] : [' and ', item],
  );
}

interface ActivityProps {
  username: string;
}

export const RecentActivity = async ({ username }: ActivityProps) => {
  const [recentUserActivity, publishedReleaseSummary] = await Promise.all([
    getRecentUserActivity(username),
    getPublishedReleaseSummary(username),
  ]);

  const activitySummary = recentUserActivity.reduce(
    (acc: any, activity: any) => {
      if (activity.type === 'PushEvent') {
        acc.commits = acc.commits || 0;
        acc.commits += activity.payload.size;
      } else if (activity.type === 'PullRequestReviewEvent') {
        acc.reviews = acc.reviews || 0;
        acc.reviews++;
      } else if (activity.type === 'IssueCommentEvent') {
        acc.commentsCreated = acc.commentsCreated || 0;
        acc.commentsCreated += activity.payload.action === 'created' ? 1 : 0;
        acc.commentsEdited = acc.commentsEdited || 0;
        acc.commentsEdited += activity.payload.action === 'edited' ? 1 : 0;
      } else if (activity.type === 'PullRequestEvent') {
        acc.prsOpened = acc.prsOpened || 0;
        acc.prsOpened += activity.payload.action === 'opened' ? 1 : 0;
        acc.prsMerged = acc.prsMerged || 0;
        acc.prsMerged +=
          activity.payload.action === 'closed' &&
          activity.payload.pull_request.merged
            ? 1
            : 0;
      } else if (activity.type === 'CreateEvent') {
        if (activity.payload.ref_type === 'tag') {
          acc.tags = acc.tags || 0;
          acc.tags++;
        } else {
          acc.branches = acc.branches || 0;
          acc.branches++;
        }
      }

      acc[activity.type] = acc[activity.type] || 0;
      acc[activity.type]++;

      return acc;
    },
    {},
  );

  const activitySummaryString = Object.keys(activitySummary)
    .map((key) => {
      const value = activitySummary[key];
      if (key === 'commits' && value) {
        return `pushed ${value} commit${value === 1 ? '' : 's'}`;
      } else if (key === 'reviews' && value) {
        return `reviewed ${value} PR${value === 1 ? '' : 's'}`;
      } else if (key === 'prsOpened' && value) {
        return `opened ${value} PR${value === 1 ? '' : 's'}`;
      } else if (key === 'prsMerged' && value) {
        return `merged ${value} PR${value === 1 ? '' : 's'}`;
      } else if (key === 'commentsCreated' && value) {
        return `made ${value} comment${value === 1 ? '' : 's'}`;
      } else if (key === 'branches' && value) {
        return `created ${value} branch${value === 1 ? '' : 'es'}`;
      } else if (key === 'tags' && value) {
        return `created ${value} tag${value === 1 ? '' : 's'}`;
      } else {
        return null;
      }
    })
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      <span className="text-sm">
        {activitySummaryString &&
          'Recent public output: ' + activitySummaryString + '.'}
      </span>
      <div className="text-sm">
        Published {publishedReleaseSummary.releaseCount} GitHub release
        {publishedReleaseSummary.releaseCount === 1 ? '' : 's'} across{' '}
        {publishedReleaseSummary.repositoryCount} public repositor
        {publishedReleaseSummary.repositoryCount === 1 ? 'y' : 'ies'}.
      </div>
    </div>
  );
};

export const CopilotActivity = async ({ username }: ActivityProps) => {
  const [
    copilotPRCount,
    codexCoauthoredCommitCount,
    codexLabeledPRCount,
    claudeCoauthoredCommitCount,
    claudeLabeledPRCount,
  ] = await Promise.all([
    getCopilotPRsAccountWide(username),
    getCodexCoauthoredCommitsAccountWide(username),
    getCodexLabeledPRsAccountWide(username),
    getClaudeCoauthoredCommitsAccountWide(username),
    getClaudeLabeledPRsAccountWide(username),
  ]);

  const codexCount = codexCoauthoredCommitCount + codexLabeledPRCount;
  const claudeCount = claudeCoauthoredCommitCount + claudeLabeledPRCount;

  if (copilotPRCount === 0 && codexCount === 0 && claudeCount === 0) {
    return null;
  }

  const agentParts: ReactNode[] = [];

  if (copilotPRCount > 0) {
    agentParts.push(
      <span key="copilot" className="mx-1 inline-flex items-center gap-1">
        Copilot{' '}
        <SiGithubcopilot
          className="h-4 w-4 text-[#8534F3]"
          aria-label="GitHub Copilot icon"
        />{' '}
        ({copilotPRCount} merged PR{copilotPRCount === 1 ? '' : 's'})
      </span>,
    );
  }

  if (codexCount > 0) {
    agentParts.push(
      <span key="codex" className="mx-1 inline-flex items-center gap-1">
        Codex <CodexIcon className="h-4 w-4 text-cyan-300" /> ({codexCount}{' '}
        contribution{codexCount === 1 ? '' : 's'})
      </span>,
    );
  }

  if (claudeCount > 0) {
    agentParts.push(
      <span key="claude" className="mx-1 inline-flex items-center gap-1">
        Claude{' '}
        <SiClaude
          className="h-4 w-4 text-orange-300"
          aria-label="Claude icon"
        />{' '}
        ({claudeCount} contribution{claudeCount === 1 ? '' : 's'})
      </span>,
    );
  }

  const agentSummary = joinWithAnd(agentParts);

  return (
    <div>
      <p className="mx-auto max-w-3xl text-sm leading-relaxed">
        AI-assisted delivery signals: {agentSummary}.
      </p>
    </div>
  );
};
