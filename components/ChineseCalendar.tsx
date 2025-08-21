import React from 'react';
import { Calendar } from 'antd';
import type { CalendarProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/locale/zh_CN';
import { ConfigProvider } from 'antd';

// 设置dayjs为中文
dayjs.locale('zh-cn');

interface ChineseCalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
  className?: string;
}

const ChineseCalendar: React.FC<ChineseCalendarProps> = ({ 
  value, 
  onChange, 
  className 
}) => {
  const handleSelect = (date: Dayjs) => {
    if (onChange) {
      onChange(date.toDate());
    }
  };

  const calendarValue = value ? dayjs(value) : undefined;

  return (
    <ConfigProvider locale={locale}>
      <div className={className}>
        <Calendar
          fullscreen={false}
          value={calendarValue}
          onSelect={handleSelect}
          style={{
            width: '100%',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}
        />
      </div>
    </ConfigProvider>
  );
};

export default ChineseCalendar;