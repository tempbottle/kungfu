
import { kungfuCancelOrder, kungfuMakeOrder } from '__io/kungfu/makeCancelOrder';
import { decodeKungfuLocation } from '__io/kungfu/watcher';

export default {

    data () {

        return {
            //adjustOrder
            adjustOrderInputVisibility: false, 
            adjustOrderInputSizeData: Object.freeze({}),
            adjustOrderTargetData: {},
            adjustOrderForm: {
                name: '', // account_id in strategy
                instrument_id: '',
                instrument_type: '',
                exchange_id: '',
                limit_price: 0,
                volume: 0,
                side: 0,
                offset: 0,
                price_type: 0,
                hedge_flag: 0,
            },
            adjustOrderProp: '',
        }
    },


    methods: {

        handleShowAdjustOrder (event, row, cell) {

            if (![1, 2, 7].includes(+row.status)) {
                return
            }

            if ((cell.prop === "volumeTraded") || (cell.prop === "limitPrice")) {
                event.stopPropagation();
            } else {
                return
            }

            const targetRectData = event.target.getBoundingClientRect();
            const left = targetRectData.left + 'px';
            const top = targetRectData.top + 'px';
            const width = targetRectData.width  + 'px';
            const height = targetRectData.height  + 'px';
            
            this.adjustOrderInputSizeData = Object.freeze({
                left,
                top,
                width,
                height
            })

            this.adjustOrderProp = cell.prop;
            this.adjustOrderTargetData = Object.freeze(row);

            //build form
            this.$set(this.adjustOrderForm, 'name', row.accountId)
            this.$set(this.adjustOrderForm, 'instrument_id', row.instrumentId)
            this.$set(this.adjustOrderForm, 'exchange_id', row.exchangeId)
            this.$set(this.adjustOrderForm, 'limit_price', row.limitPrice)
            this.$set(this.adjustOrderForm, 'volume', row.volumeLeft)
            this.$set(this.adjustOrderForm, 'volumeLeft', row.volumeLeft)
            this.$set(this.adjustOrderForm, 'side', row.sideOrigin)
            this.$set(this.adjustOrderForm, 'offset', row.offsetOrigin)
            this.$set(this.adjustOrderForm, 'price_type', row.priceTypeOrigin)
            this.$set(this.adjustOrderForm, 'hedge_flag', row.hedgeFlagOrigin)

            this.$nextTick()
                .then(() => {
                    this.adjustOrderInputVisibility = true;
                })
        },

        handleBlurAdjustOrderInput () {
            const { instrument_id, limit_price, volume, volumeLeft } = this.adjustOrderForm;

            if (!+limit_price) {
                this.clearAdjustOrderData()
                return
            }

            if (!+volume) {
                this.clearAdjustOrderData()
                return
            }

            this.$confirm(
                `确认调整： 商品 ${instrument_id}, 价格 ${limit_price}, 原未交易量 ${volumeLeft}, 新设定交易量 ${volume}`, 
                '提示', 
                {
                    confirmButtonText: '确 定', 
                    cancelButtonText: '取 消'
                })
                .then(() => this.cancelOrder(this.adjustOrderTargetData))
                .then(() => this.makeOrder(
                    this.moduleType, 
                    this.adjustOrderForm, 
                    this.getAdjustOrderAccountResolved(), 
                    this.currentId
                ))
                .then(() => this.$message.success('调仓指令发送成功！'))
                .catch((err) => {
                    if(err == 'cancel') return;
                    this.$message.error(err.message || '操作失败！')
                })
                .finally(() => {
                    this.clearAdjustOrderData()
                })

        },

        handleHideAdjustOrder () {
            this.clearAdjustOrderData();
        },

        handleCancelOrder (orderData) {
            return this.cancelOrder(orderData)
                .then(() => this.$message.success('撤单指令已发送！'))
                .catch(err => this.$message.error(err.message || '撤单指令发送失败！'))
        },

        getAdjustOrderAccountResolved () {
            if (this.moduleType === 'account') {
                return this.currentId
            } else if (this.moduleType === 'strategy') {
                return this.adjustOrderForm.name
            }
        }, 

        cancelOrder (orderData) {
            const kungfuLocation = decodeKungfuLocation(orderData.source);
            const accountId = `${kungfuLocation.group}_${kungfuLocation.name}`;
            
            //撤单   
            if (this.moduleType === 'strategy') {
                return kungfuCancelOrder( orderData.orderId, accountId, this.currentId)
            } else if (this.moduleType === 'account') {
                return kungfuCancelOrder( orderData.orderId, accountId)
            }
        },

        makeOrder (moduleType, makeOrderForm, currentAccountResolved, strategyId) {
            if (moduleType === 'account') {
                return kungfuMakeOrder(makeOrderForm, currentAccountResolved)
            } else if (moduleType === 'strategy') {
                return kungfuMakeOrder(makeOrderForm, currentAccountResolved, strategyId)
            }
        },

        clearAdjustOrderData () {
            this.adjustOrderInputVisibility = false;
            this.adjustOrderInputSizeData = Object.freeze({});
            this.adjustOrderTargetData = Object({});
            this.adjustOrderForm = {
                name: '', // account_id in strategy
                instrument_id: '',
                instrument_type: '',
                exchange_id: '',
                limit_price: 0,
                volume: 0,
                side: 0,
                offset: 0,
                price_type: 0,
                hedge_flag: 0,
            };
            this.adjustOrderProp = '';
        }
    }
}