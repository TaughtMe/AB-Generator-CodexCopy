import React from 'react';
import { clsx } from 'clsx';

type IconButtonSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<IconButtonSize, string> = {
    sm: 'p-1 rounded',
    md: 'p-1.5 rounded-md',
    lg: 'p-2 rounded-lg',
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

