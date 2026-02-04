/**
 * Metrics Card Component
 * 
 * Displays key performance indicators in a card format.
 * Used throughout the admin dashboard to show portfolio metrics.
 * 
 * Features:
 * - Color-coded indicators
 * - Icon support
 * - Responsive design
 * - Consistent styling
 */

'use client';

import { 
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: 'document' | 'check' | 'clock' | 'exclamation' | 'currency' | 'chart' | 'calculator';
  color: 'blue' | 'green' | 'yellow' | 'red';
}

const iconMap = {
  document: DocumentTextIcon,
  check: CheckCircleIcon,
  clock: ClockIcon,
  exclamation: ExclamationTriangleIcon,
  currency: CurrencyDollarIcon,
  chart: ChartBarIcon,
  calculator: CalculatorIcon,
};

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    text: 'text-blue-900',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    text: 'text-green-900',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    text: 'text-yellow-900',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    text: 'text-red-900',
  },
};

export default function MetricsCard({ title, value, icon, color }: MetricsCardProps) {
  const Icon = iconMap[icon];
  const colors = colorClasses[color];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${colors.text}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}
