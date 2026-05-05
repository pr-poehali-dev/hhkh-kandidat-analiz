import { CandidateStatus, statusLabels } from '@/data/mockData';

interface StatusBadgeProps {
  status: CandidateStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cls: Record<CandidateStatus, string> = {
    new: 'tag-new',
    review: 'tag-review',
    test: 'tag-test',
    check: 'tag-check',
    interview: 'tag-interview',
    offer: 'tag-offer',
    reject: 'tag-reject',
  };
  return <span className={cls[status]}>{statusLabels[status]}</span>;
}