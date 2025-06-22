// FullItemDisplay Component for Custom System Builder
// Displays the complete structure of EquippableItems within character sheets

import Container from '../../../../../../systems/custom-system-builder/module/sheets/components/Container.js';
import { castToPrimitive } from '../../../../../../systems/custom-system-builder/module/utils.js';
import Formula from '../../../../../../systems/custom-system-builder/module/formulas/Formula.js';

class FullItemDisplay extends Container {
  constructor(props) {
    super(props);
    this._title = props.title ?? '';
    this._templateFilter = props.templateFilter ?? [];
    this._itemFilterFormula = props.itemFilterFormula ?? '';
    this._showItemHeader = props.showItemHeader ?? true;
    this._collapsibleItems = props.collapsibleItems ?? false;
    this._defaultItemCollapsed = props.defaultItemCollapsed ?? false;
    this._showItemControls = props.showItemControls ?? true;
    this._itemLayout = props.itemLayout ?? 'vertical';
    this._hideEmpty = props.hideEmpty ?? false;
  }

  async _getElement(entity, isEditable = true, options = {}) {
    const jQElement = await super._getElement(entity, isEditable, options);
    const internalContents = jQElement.hasClass('custom-system-component-contents') ? jQElement : jQElement.find('.custom-system-component-contents');

    const relevantItems = this.filterItems(entity, options);

    if (this._hideEmpty && relevantItems.length === 0 && !entity.isTemplate) {
      jQElement.addClass('hidden');
      return jQElement;
    }

    if (this._title) {
      const titleElement = $('<h3></h3>').addClass('custom-system-full-item-display-title').text(this._title);
      internalContents.append(titleElement);
    }

    let layoutClass = 'flexcol';
    if (this._itemLayout === 'horizontal') layoutClass = 'flexrow';
    else if (this._itemLayout === 'grid2') layoutClass = 'grid grid-2col';
    else if (this._itemLayout === 'grid3') layoutClass = 'grid grid-3col';
    else if (this._itemLayout === 'grid4') layoutClass = 'grid grid-4col';
    else if (this._itemLayout === 'grid5') layoutClass = 'grid grid-5col';
    else if (this._itemLayout === 'grid6') layoutClass = 'grid grid-6col';

    internalContents.addClass(layoutClass);

    for (const item of relevantItems) {
      const itemContainer = await this._renderFullItemStructure(item, entity, isEditable, options);
      internalContents.append(itemContainer);
    }

    if (entity.isTemplate) {
      internalContents.append(await this.renderTemplateControls(entity));
    }

    return jQElement;
  }

  async _renderFullItemStructure(item, entity, isEditable, options) {
    const itemWrapper = $('<div></div>').addClass('custom-system-full-item-wrapper').attr('data-item-id', item.id);
    const itemTemplate = game.items?.get(item.system.template);

    if (!itemTemplate) {
      return $('<div></div>').addClass('custom-system-item-template-error').html(`<i class="fas fa-exclamation-triangle"></i> Template not found for item: ${item.name}`);
    }
      item.entity = entity.entity
    if (this._collapsibleItems) {
      const isExpanded = game.user.getFlag(game.system.id, `${entity.uuid}.${this.templateAddress}.${item.id}.expanded`) ?? !this._defaultItemCollapsed;
      const detailsElement = $('<details></details>').addClass('custom-system-full-item-details');
      if (isExpanded) detailsElement.attr('open', 'open');

      detailsElement.on('toggle', (e) => {
        game.user.setFlag(game.system.id, `${entity.uuid}.${this.templateAddress}.${item.id}.expanded`, e.currentTarget.open);
      });

      const summaryElement = $('<summary></summary>').addClass('custom-system-full-item-summary').append(await this._renderItemHeader(item, entity, isEditable, options));
      detailsElement.append(summaryElement);

      const contentElement = $('<div></div>').addClass('custom-system-full-item-content');
      const renderedTemplate = await this._renderItemTemplate(item, itemTemplate, entity, isEditable, options);
      contentElement.append(renderedTemplate);
      detailsElement.append(contentElement);

      itemWrapper.append(detailsElement);
    } else {
      if (this._showItemHeader) {
        itemWrapper.append($('<div></div>').addClass('custom-system-full-item-header').append(await this._renderItemHeader(item, entity, isEditable, options)));
      }

      const contentElement = $('<div></div>').addClass('custom-system-full-item-content');
      const renderedTemplate = await this._renderItemTemplate(item, itemTemplate, entity, isEditable, options);
      contentElement.append(renderedTemplate);
      itemWrapper.append(contentElement);
    }

    return itemWrapper;
  }

  async _renderItemHeader(item, entity, isEditable, options) {
    const headerDiv = $('<div></div>').addClass('custom-system-item-header-content flexrow');
    const itemLink = $('<a></a>').addClass('content-link')
      .attr({
        'data-type': 'Item',
        'data-entity': 'Item',
        'data-id': item.id,
        'data-uuid': item.uuid,
        'data-tooltip': item.name,
        draggable: true
      }).text(item.name)
      .on('click', () => item.sheet?.render(true));
    headerDiv.append(itemLink);

    if (this._showItemControls && isEditable && !entity.isTemplate) {
      const controlsDiv = $('<div></div>').addClass('custom-system-item-controls');

      const editButton = $('<a></a>').addClass('custom-system-clickable').attr('title', 'Edit Item').html('<i class="fas fa-edit"></i>')
        .on('click', () => item.sheet?.render(true));
      const deleteButton = $('<a></a>').addClass('custom-system-clickable').attr('title', 'Delete Item').html('<i class="fas fa-trash"></i>')
        .on('click', async () => {
          const confirmed = await Dialog.confirm({
            title: 'Delete Item',
            content: `<p>Are you sure you want to delete "${item.name}"?</p>`,
            yes: () => true,
            no: () => false
          });
          if (confirmed) await item.delete();
          entity.render(false);
        });

      controlsDiv.append(editButton).append(deleteButton);
      headerDiv.append(controlsDiv);
    }

    return headerDiv;
  }

  async _renderItemTemplate(item, itemTemplate, entity, isEditable, options) {
    const templateDiv = $('<div></div>').addClass('custom-system-item-template-structure');

    try {
      if (!itemTemplate || !itemTemplate.system?.body) {
        return templateDiv.html(`<i class="fas fa-exclamation-triangle"></i> Template or body not found for item: ${item.name}`);
      }

      const bodyComponent = componentFactory.createOneComponent(
        itemTemplate.system.body,
        `${this.templateAddress}.${item.id}.body`,
        this
      );

      const renderOptions = {
        ...options,
        reference: `${this.key}.${item.id}`,
        linkedEntity: item,
        customProps: {
          ...(options.customProps || {}),
          itemSystemProps: item.system.props,
          itemTemplateSystemProps: itemTemplate.system.props,
          item: item.system.props
        }
      };

      const renderedBody = await bodyComponent.render(item, isEditable, renderOptions);
      templateDiv.append(renderedBody);

      // Patch: Make field updates persist to item
      if (isEditable) {
        renderedBody.find('input, textarea, select').on('change', async (event) => {
          const input = event.currentTarget;
          const path = input.name;
          if (!path) return;
          const value = input.type === 'checkbox' ? input.checked : input.value;
          try {
            await item.update({ [path]: value });
          } catch (err) {
            console.error(`Error updating item field '${path}'`, err);
          }
        });
      }
    } catch (error) {
      console.error(`[FullItemDisplay] Error rendering template for item "${item.name}":`, error);
      templateDiv.append(`<div class="custom-system-template-render-error"><i class="fas fa-exclamation-triangle"></i> Error rendering ${item.name}</div>`);
    }

    return templateDiv;
  }

  filterItems(entity, options) {
    return entity.items.filter((item) => {
      if (item.type !== 'equippableItem') return false;
      if (this._templateFilter.length && !this._templateFilter.includes(item.system.template)) return false;

      if (this._itemFilterFormula) {
        try {
          const result = new Formula(this._itemFilterFormula).computeStatic({
            ...entity.system.props,
            item: item.system.props
          }, { ...options, source: `${this.key}.${item.name}.filter` }).result;
          return !!castToPrimitive(result);
        } catch (error) {
          console.warn('Item filter formula error:', error);
          return true;
        }
      }

      return true;
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      title: this._title,
      templateFilter: this._templateFilter,
      itemFilterFormula: this._itemFilterFormula,
      showItemHeader: this._showItemHeader,
      collapsibleItems: this._collapsibleItems,
      defaultItemCollapsed: this._defaultItemCollapsed,
      showItemControls: this._showItemControls,
      itemLayout: this._itemLayout,
      hideEmpty: this._hideEmpty
    };
  }

  static fromJSON(json, templateAddress, parent) {
    return new FullItemDisplay({
      key: json.key,
      tooltip: json.tooltip,
      templateAddress: templateAddress,
      cssClass: json.cssClass,
      title: json.title,
      templateFilter: json.templateFilter,
      itemFilterFormula: json.itemFilterFormula,
      showItemHeader: json.showItemHeader,
      collapsibleItems: json.collapsibleItems,
      defaultItemCollapsed: json.defaultItemCollapsed,
      showItemControls: json.showItemControls,
      itemLayout: json.itemLayout,
      hideEmpty: json.hideEmpty,
      contents: [],
      role: json.role,
      permission: json.permission,
      visibilityFormula: json.visibilityFormula,
      parent: parent
    });
  }

  static getTechnicalName() {
    return 'fullItemDisplay';
  }

  static getPrettyName() {
    return game.i18n.localize('CSB.ComponentProperties.ComponentType.FullItemDisplay');
  }

  static async getConfigForm(existingComponent, entity) {
    const predefinedValues = { ...existingComponent };
    predefinedValues.title ??= '';
    predefinedValues.showItemHeader ??= true;
    predefinedValues.collapsibleItems ??= false;
    predefinedValues.defaultItemCollapsed ??= false;
    predefinedValues.showItemControls ??= true;
    predefinedValues.itemLayout ??= 'vertical';
    predefinedValues.hideEmpty ??= false;
    predefinedValues.itemFilterFormula ??= '';

    predefinedValues.availableTemplates = (game.items?.filter(i => i.type === '_equippableItemTemplate') || []).map(template => ({
      id: template.id,
      name: template.name,
      checked: existingComponent?.templateFilter?.includes(template.id)
    }));

    const mainElt = $('<div></div>');
    mainElt.append(await renderTemplate(`modules/full-item-display/csb-components/templates/_template/components/fullItemDisplay.hbs`, predefinedValues));
    return mainElt;
  }

  static extractConfig(html) {
    const superData = super.extractConfig(html);
    return {
      ...superData,
      title: html.find('#fullItemTitle').val()?.toString() ?? '',
      showItemHeader: html.find('#showItemHeader').is(':checked'),
      collapsibleItems: html.find('#collapsibleItems').is(':checked'),
      defaultItemCollapsed: html.find('#defaultItemCollapsed').is(':checked'),
      showItemControls: html.find('#showItemControls').is(':checked'),
      itemLayout: html.find('#itemLayout').val()?.toString() ?? 'vertical',
      hideEmpty: html.find('#hideEmpty').is(':checked'),
      itemFilterFormula: html.find('#itemFilterFormula').val()?.toString() ?? '',
      templateFilter: html.find('input[name=templateFilter]:checked').map(function () {
        return $(this).val()?.toString();
      }).get()
    };
  }
}

export default FullItemDisplay;

Hooks.on('init', () => {
  console.log("====================================Initialize Full Item Display============================================")
  componentFactory.addComponentType('fullItemDisplay', FullItemDisplay);
});

