import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import { DropdownButton, MenuItem, Button } from 'react-bootstrap';
import Reflux from 'reflux';

import { QuickValuesVisualization, QuickValuesHistogramVisualization } from 'components/visualizations';
import AddToDashboardMenu from 'components/dashboard/AddToDashboardMenu';
import Spinner from 'components/common/Spinner';
import UIUtils from 'util/UIUtils';
import QuickValuesOptionsForm from './QuickValuesOptionsForm';

import style from './FieldQuickValues.css';

import CombinedProvider from 'injection/CombinedProvider';

const { FieldQuickValuesStore, FieldQuickValuesActions } = CombinedProvider.get('FieldQuickValues');
const { RefreshStore } = CombinedProvider.get('Refresh');

const FieldQuickValues = React.createClass({
  propTypes: {
    permissions: PropTypes.arrayOf(PropTypes.string).isRequired,
    query: PropTypes.string.isRequired,
    rangeType: PropTypes.string.isRequired,
    rangeParams: PropTypes.object.isRequired,
    stream: PropTypes.object,
    forceFetch: PropTypes.bool,
    fields: PropTypes.arrayOf(PropTypes.object),
  },
  mixins: [Reflux.listenTo(RefreshStore, '_setupTimer', '_setupTimer'), Reflux.connect(FieldQuickValuesStore)],

  getDefaultProps() {
    return {
      fields: [],
    };
  },

  getInitialState() {
    return {
      field: undefined,
      data: [],
      showVizOptions: false,
      showHistogram: false,
      options: {
        order: 'desc',
        limit: 5,
        tableSize: 50,
        stackedFields: '',
        interval: undefined,
      },
    };
  },

  componentDidMount() {
    this._loadQuickValuesData();
  },
  componentWillReceiveProps(nextProps) {
    // Reload values when executed search changes
    if (this.props.query !== nextProps.query ||
        this.props.rangeType !== nextProps.rangeType ||
        JSON.stringify(this.props.rangeParams) !== JSON.stringify(nextProps.rangeParams) ||
        this.props.stream !== nextProps.stream ||
        nextProps.forceFetch) {
      this._loadQuickValuesData();
    }
  },
  componentDidUpdate(oldProps, oldState) {
    if (this.state.field !== oldState.field) {
      const element = ReactDOM.findDOMNode(this);
      UIUtils.scrollToHint(element);
    }
  },
  componentWillUnmount() {
    this._stopTimer();
  },

  WIDGET_TYPE: 'QUICKVALUES',
  WIDGET_TYPE_HISTOGRAM: 'QUICKVALUES_HISTOGRAM',

  _setupTimer(refresh) {
    this._stopTimer();
    if (refresh.enabled) {
      this.timer = setInterval(this._loadQuickValuesData, refresh.interval);
    }
  },
  _stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  addField(field) {
    this.setState({ field: field }, () => this._loadQuickValuesData(false));
  },
  _loadQuickValuesData() {
    if (this.state.field !== undefined) {
      if (this.state.showHistogram) {
        FieldQuickValuesActions.getHistogram(this.state.field, this.state.options);
      } else {
        FieldQuickValuesActions.get(this.state.field, this.state.options);
      }
    }
  },
  _resetStatus() {
    this.setState(this.getInitialState());
  },

  _onVizOptionsChange(newOptions) {
    this.setState({ options: newOptions, showVizOptions: false }, () => this._loadQuickValuesData());
  },

  _onVizOptionsCancel() {
    this.setState({ showVizOptions: false });
  },

  _showVizOptions() {
    this.setState({ showVizOptions: true });
  },

  _showHistogram() {
    // Reset the data when toggling histogram
    this.setState({ data: [], showHistogram: true }, this._loadQuickValuesData);
  },

  _showOverview() {
    // Reset the data when toggling histogram
    this.setState({ data: [], showHistogram: false}, this._loadQuickValuesData);
  },

  _buildDashboardConfig(isHistogram) {
    // Map internal state fields to widget config fields. (snake case vs. camel case)
    const baseConfig = {
      field: this.state.field,
      limit: this.state.options.limit,
      sort_order: this.state.options.order,
      stacked_fields: this.state.options.stackedFields,
    };

    if (isHistogram) {
      return Object.assign(baseConfig, {
        interval: this.state.options.interval,
      });
    }

    return Object.assign(baseConfig, {
      data_table_limit: this.state.options.tableSize,
    });
  },

  render() {
    let content;

    let inner;
    if (this.state.showVizOptions) {
      inner = (
        <div className={style.optionsFormWrapper}>
          <QuickValuesOptionsForm limit={this.state.options.limit}
                                  tableSize={this.state.options.tableSize}
                                  order={this.state.options.order}
                                  stackedFields={this.state.options.stackedFields}
                                  stackedFieldsOptions={this.props.fields}
                                  field={this.state.field}
                                  interval={this.state.options.interval}
                                  isHistogram={this.state.showHistogram}
                                  onSave={this._onVizOptionsChange}
                                  onCancel={this._onVizOptionsCancel} />
        </div>
      );
    } else if (this.state.data.length === 0) {
      inner = (
        <div className={style.spinnerWrapper}>
          <Spinner />;
        </div>
      );
    } else if (this.state.showHistogram) {
      const config = {
        sort_order: this.state.options.order,
        limit: this.state.options.limit,
        interval: this.state.options.interval,
        field: this.state.field,
      };
      inner = (
        <div className={style.visualizationWrapper}>
          <QuickValuesHistogramVisualization id={this.state.field}
                                             config={config}
                                             data={this.state.data} />
        </div>
      );
    } else {
      const config = {
        show_pie_chart: true,
        show_data_table: true,
        data_table_limit: this.state.options.tableSize,
        sort_order: this.state.options.order,
        limit: this.state.options.limit,
      };
      inner = (
        <div className={style.visualizationWrapper}>
          <QuickValuesVisualization id={this.state.field}
                                    config={config}
                                    data={this.state.data}
                                    horizontal
                                    displayAddToSearchButton
                                    displayAnalysisInformation />
        </div>
      );
    }

    if (this.state.field !== undefined) {
      let toggleVizType;
      let widgetType;
      if (this.state.showHistogram) {
        toggleVizType = <MenuItem onSelect={this._showOverview}>Show overview</MenuItem>;
        widgetType = this.WIDGET_TYPE_HISTOGRAM;
      } else {
        toggleVizType = <MenuItem onSelect={this._showHistogram}>Show as histogram</MenuItem>;
        widgetType = this.WIDGET_TYPE;
      }
      content = (
        <div className="content-col">
          <div className="pull-right">
            <AddToDashboardMenu title="Add to dashboard"
                                widgetType={widgetType}
                                configuration={this._buildDashboardConfig(this.state.showHistogram)}
                                pullRight
                                permissions={this.props.permissions}>
              <DropdownButton bsSize="small"
                              className="graph-settings"
                              title="Customize"
                              id="customize-field-graph-dropdown">
                <MenuItem onSelect={this._showVizOptions}>Configuration</MenuItem>
                {toggleVizType}
              </DropdownButton>
              <Button bsSize="small" className="field-analyzer-close" onClick={() => this._resetStatus()}><i className="fa fa-close" /></Button>
            </AddToDashboardMenu>
          </div>
          <h1>Quick Values for <em>{this.state.field}</em> {this.state.loadPending && <i
            className="fa fa-spin fa-spinner" />}</h1>

          {inner}
        </div>
      );
    }
    return <div id="field-quick-values">{content}</div>;
  },
});

export default FieldQuickValues;
