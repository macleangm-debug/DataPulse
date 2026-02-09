/**
 * Push Notification Service
 * Handles Web Push notification subscription with backend VAPID keys
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

class PushNotificationService {
  constructor() {
    this.vapidPublicKey = null;
    this.subscription = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Get VAPID public key from backend
   */
  async getVapidPublicKey() {
    if (this.vapidPublicKey) {
      return this.vapidPublicKey;
    }

    try {
      const response = await fetch(`${API_URL}/api/push/vapid-public-key`);
      const data = await response.json();
      this.vapidPublicKey = data.public_key;
      return this.vapidPublicKey;
    } catch (error) {
      console.error('Failed to get VAPID public key:', error);
      throw error;
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Check if push notifications are supported
   */
  checkSupport() {
    if (!this.isSupported) {
      return {
        supported: false,
        reason: 'Push notifications not supported in this browser'
      };
    }

    if (Notification.permission === 'denied') {
      return {
        supported: true,
        blocked: true,
        reason: 'Notifications blocked by user'
      };
    }

    return {
      supported: true,
      blocked: false
    };
  }

  /**
   * Request notification permission
   */
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(userId, orgId, deviceId = null, preferences = null) {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    try {
      // Get VAPID public key
      const vapidKey = await this.getVapidPublicKey();
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      // If no subscription or different key, create new one
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
        });
      }

      // Send subscription to backend
      const response = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
          },
          user_id: userId,
          org_id: orgId,
          device_id: deviceId,
          preferences: preferences
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register subscription with server');
      }

      const data = await response.json();
      this.subscription = subscription;
      
      return {
        success: true,
        subscriptionId: data.subscription_id,
        subscription
      };

    } catch (error) {
      console.error('Push subscription error:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from backend
        await fetch(`${API_URL}/api/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}&user_id=${userId}`, {
          method: 'DELETE'
        });
      }

      this.subscription = null;
      return { success: true };

    } catch (error) {
      console.error('Push unsubscribe error:', error);
      throw error;
    }
  }

  /**
   * Check if currently subscribed
   */
  async isSubscribed() {
    if (!this.isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current subscription
   */
  async getSubscription() {
    if (!this.isSupported) return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch (error) {
      return null;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId, preferences) {
    try {
      const response = await fetch(`${API_URL}/api/push/subscriptions/${userId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      return await response.json();
    } catch (error) {
      console.error('Update preferences error:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(userId) {
    try {
      const response = await fetch(`${API_URL}/api/push/test?user_id=${userId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      return await response.json();
    } catch (error) {
      console.error('Test notification error:', error);
      throw error;
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(orgId, limit = 50, notificationType = null) {
    try {
      let url = `${API_URL}/api/push/history/${orgId}?limit=${limit}`;
      if (notificationType) {
        url += `&notification_type=${notificationType}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to get notification history');
      }

      return await response.json();
    } catch (error) {
      console.error('Get history error:', error);
      throw error;
    }
  }

  /**
   * Get quality alerts
   */
  async getQualityAlerts(orgId, status = null, limit = 50) {
    try {
      let url = `${API_URL}/api/push/alerts/${orgId}?limit=${limit}`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to get quality alerts');
      }

      return await response.json();
    } catch (error) {
      console.error('Get alerts error:', error);
      throw error;
    }
  }

  /**
   * Update alert status
   */
  async updateAlertStatus(orgId, submissionId, status, reviewedBy) {
    try {
      const response = await fetch(
        `${API_URL}/api/push/alerts/${orgId}/${submissionId}/status?status=${status}&reviewed_by=${reviewedBy}`,
        { method: 'PUT' }
      );

      if (!response.ok) {
        throw new Error('Failed to update alert status');
      }

      return await response.json();
    } catch (error) {
      console.error('Update alert status error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
