/**
 * Notifications module — Notification service, bus, desktop notifier.
 */

import type { DependencyContainer } from 'tsyringe';

import type { INotificationService } from '../../../application/ports/output/services/notification-service.interface.js';
import { DesktopNotifier } from '../../services/notifications/desktop-notifier.js';
import { NotificationService } from '../../services/notifications/notification.service.js';
import { getNotificationBus } from '../../services/notifications/notification-bus.js';

export function registerNotifications(container: DependencyContainer): void {
  const notificationBus = getNotificationBus();

  container.registerInstance('NotificationEventBus', notificationBus);

  container.register('DesktopNotifier', {
    useFactory: () => new DesktopNotifier(),
  });

  container.register<INotificationService>('INotificationService', {
    useFactory: (c) => {
      const bus = c.resolve('NotificationEventBus') as ReturnType<typeof getNotificationBus>;
      const desktopNotif = c.resolve('DesktopNotifier') as DesktopNotifier;
      return new NotificationService(bus, desktopNotif);
    },
  });
}
