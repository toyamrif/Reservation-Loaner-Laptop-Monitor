/**
 * モデルインデックス
 * 全てのモデルをエクスポート
 */

const Reservation = require('./Reservation');
const EquipmentItem = require('./EquipmentItem');
const Inventory = require('./Inventory');
const SiteManager = require('./SiteManager');
const NotificationLog = require('./NotificationLog');

module.exports = {
  Reservation,
  EquipmentItem,
  Inventory,
  SiteManager,
  NotificationLog
};