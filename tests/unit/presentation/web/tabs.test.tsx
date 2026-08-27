import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

describe('Tabs', () => {
  describe('TabsList', () => {
    it('renders with default classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tabsList = screen.getByTestId('tabs-list');
      expect(tabsList).toBeInTheDocument();
      expect(tabsList).toHaveClass('inline-flex', 'h-9', 'items-center', 'justify-center');
    });

    it('applies scroll classes when scrollable={true}', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList scrollable data-testid="tabs-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tabsList = screen.getByTestId('tabs-list');
      expect(tabsList).toHaveClass('overflow-x-auto', 'overflow-y-hidden', 'flex', 'w-full');
    });

    it('does not apply scroll classes when scrollable={false}', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList scrollable={false} data-testid="tabs-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tabsList = screen.getByTestId('tabs-list');
      expect(tabsList).not.toHaveClass('overflow-x-auto', 'overflow-y-hidden');
    });

    it('merges custom className with scroll classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList scrollable className="custom-class" data-testid="tabs-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tabsList = screen.getByTestId('tabs-list');
      expect(tabsList).toHaveClass(
        'custom-class',
        'overflow-x-auto',
        'overflow-y-hidden',
        'flex',
        'w-full'
      );
    });

    it('renders tabs with triggers', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByRole('tab', { name: /tab 1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tab 2/i })).toBeInTheDocument();
    });

    it('renders content for active tab', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });
  });
});
