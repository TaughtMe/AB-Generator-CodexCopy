import React from 'react';
import { clsx } from 'clsx';

type IconButtonSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<IconButtonSize, string> = {
    sm: 'p-1 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
    md: 'p-1.5 rounded-md min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
    lg: 'p-2 rounded-lg min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    size?: IconButtonSize;
}

export const IconButton: React.FC<IconButtonProps> = ({
    size = 'md',
    type = 'button',
    className,
    children,
    ...props
}) => (
    <button
        type={type}
        className={clsx(
            'inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
            SIZE_CLASSES[size],
            className,
        )}
        {...props}
    >
        {children}
    </button>
);

