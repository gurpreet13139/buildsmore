import React from 'react';
import { Link, useInRouterContext } from 'react-router-dom';

interface AppLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

/**
 * Semantic crawlable <a href> navigation link powered by React Router <Link>.
 * Executes native browser-history SPA routing on normal left-clicks while
 * preserving Cmd/Ctrl/middle-click new tabs, SSR crawlability, and fallback
 * behavior when rendered outside a router context in isolated unit tests.
 */
export const AppLink: React.FC<AppLinkProps> = ({
  href,
  onNavigate,
  onClick,
  children,
  ...rest
}) => {
  const inRouter = useInRouterContext();
  const isExternal =
    /^(https?:|mailto:|tel:|#)/i.test(href) ||
    Boolean(rest.target && rest.target !== '_self');

  if (inRouter && !isExternal) {
    return (
      <Link to={href} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }

  const handleFallbackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }
    if (e.defaultPrevented) return;
    if (!onNavigate || isExternal) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(href);
  };

  return (
    <a href={href} onClick={handleFallbackClick} {...rest}>
      {children}
    </a>
  );
};
