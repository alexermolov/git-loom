import React from 'react';
import { Tooltip } from 'antd';
import { 
  FileTextOutlined, 
  BranchesOutlined, 
  HistoryOutlined, 
  FolderOpenOutlined,
  ApartmentOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

export type ViewType = 'changes' | 'commits' | 'graph' | 'branches' | 'fileTree' | 'reflog';

interface IconSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const IconSidebar: React.FC<IconSidebarProps> = ({ activeView, onViewChange }) => {
  const icons = [
    { key: 'changes' as ViewType, icon: <FileTextOutlined />, tooltip: 'Source Control' },
    { key: 'commits' as ViewType, icon: <HistoryOutlined />, tooltip: 'Commits History' },
    { key: 'graph' as ViewType, icon: <ApartmentOutlined />, tooltip: 'Git Graph' },
    { key: 'branches' as ViewType, icon: <BranchesOutlined />, tooltip: 'Branches' },
    { key: 'reflog' as ViewType, icon: <ClockCircleOutlined />, tooltip: 'Reflog' },
    { key: 'fileTree' as ViewType, icon: <FolderOpenOutlined />, tooltip: 'File Explorer' },
  ];

  return (
    <div className="icon-sidebar">
      {icons.map(({ key, icon, tooltip }) => (
        <Tooltip key={key} title={tooltip} placement="right">
          <div
            className={`icon-sidebar-item ${activeView === key ? 'active' : ''}`}
            onClick={() => onViewChange(key)}
          >
            {icon}
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

export default IconSidebar;
