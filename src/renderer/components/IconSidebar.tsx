import React from 'react';
import { Tooltip, Badge } from 'antd';
import { 
  FileTextOutlined, 
  BranchesOutlined, 
  HistoryOutlined, 
  FolderOpenOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  SaveOutlined,
  WarningOutlined,
  SearchOutlined
} from '@ant-design/icons';

export type ViewType = 'changes' | 'commits' | 'graph' | 'branches' | 'fileTree' | 'reflog' | 'stash' | 'conflicts' | 'search';

interface IconSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  conflictCount?: number;
}

const IconSidebar: React.FC<IconSidebarProps> = ({ activeView, onViewChange, conflictCount = 0 }) => {
  const icons = [
    { key: 'search' as ViewType, icon: <SearchOutlined />, tooltip: 'Search Commits' },
    { key: 'changes' as ViewType, icon: <FileTextOutlined />, tooltip: 'Source Control' },
    { key: 'commits' as ViewType, icon: <HistoryOutlined />, tooltip: 'Commits History' },
    { key: 'branches' as ViewType, icon: <BranchesOutlined />, tooltip: 'Branches' },
    { key: 'conflicts' as ViewType, icon: <WarningOutlined />, tooltip: 'Merge Conflicts', badge: conflictCount },
    { key: 'stash' as ViewType, icon: <SaveOutlined />, tooltip: 'Stashes' },
    { key: 'reflog' as ViewType, icon: <ClockCircleOutlined />, tooltip: 'Reflog' },
    { key: 'fileTree' as ViewType, icon: <FolderOpenOutlined />, tooltip: 'File Explorer' },
  ];

  return (
    <div className="icon-sidebar">
      {icons.map(({ key, icon, tooltip, badge }) => (
        <Tooltip key={key} title={tooltip} placement="right">
          <div
            className={`icon-sidebar-item ${activeView === key ? 'active' : ''}`}
            onClick={() => onViewChange(key)}
          >
            {badge !== undefined && badge > 0 ? (
              <Badge count={badge} size="small" offset={[5, -5]}>
                {icon}
              </Badge>
            ) : (
              icon
            )}
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

export default IconSidebar;
